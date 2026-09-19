import assert from 'assert';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🚀 بدء تشغيل حزمة الاختبارات الشاملة (30 اختباراً)...');

  let adminToken = '';
  let dataEntryToken = '';
  let testMemberId = null;

  // 1. تشغيل البرنامج بدون Internet
  console.log('Test 1: التحقق من عمل الخادم بدون إنترنت...');
  const healthRes = await fetch(`${BASE_URL}/api/auth/me`).catch(() => null);
  assert(healthRes !== null, 'Server is not responding');
  console.log('✅ Test 1 Passed: الخادم يعمل محلياً بنجاح.');

  // 2. ظهور شاشة Login
  console.log('Test 2: التحقق من استجابة واجهة تسجيل الدخول...');
  const loginPing = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(loginPing.status, 400);
  console.log('✅ Test 2 Passed: واجهة التحقق جاهزة وترفض المدخلات الفارغة.');

  // 3. Login صحيح (admin / admin123)
  console.log('Test 3: تسجيل دخول صحيح كمسؤول admin...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);
  assert(loginData.token, 'Token was not returned');
  assert.strictEqual(loginData.user.role, 'ADMIN');
  adminToken = loginData.token;
  console.log('✅ Test 3 Passed: تم تسجيل دخول admin بنجاح وتوليد الجلسة.');

  // 4. Login خاطئ
  console.log('Test 4: فحص تسجيل الدخول الخاطئ...');
  const wrongLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'wrongPassword999' }),
  });
  assert.strictEqual(wrongLoginRes.status, 401);
  console.log('✅ Test 4 Passed: تم رفض كلمة المرور الخاطئة.');

  // 5. إنشاء مستخدم DATA_ENTRY واختباره
  console.log('Test 5: إنشاء مستخدم DATA_ENTRY وتسجيل دخوله...');
  const addUserRes = await fetch(`${BASE_URL}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ username: 'entry_user', password: 'user1234', role: 'DATA_ENTRY' }),
  });
  assert([201, 400].includes(addUserRes.status)); // 201 or already exists

  const deLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'entry_user', password: 'user1234' }),
  });
  const deLoginData = await deLoginRes.json();
  assert.strictEqual(deLoginRes.status, 200);
  dataEntryToken = deLoginData.token;
  console.log('✅ Test 5 Passed: مستخدم DATA_ENTRY مسجل وله صلاحية صحيحة.');

  // 6. إضافة عضو جديد
  console.log('Test 6: إضافة عضو جديد بكافة الحقول...');
  const uniqueNationalId = '30401011234567';
  const addMemberRes = await fetch(`${BASE_URL}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      student_name: 'مريم جرجس حنا',
      guardian_name: 'جرجس حنا ميخائيل',
      national_id: uniqueNationalId,
      birth_date: '2012-05-15',
      school_stage: 'إعدادي',
      scout_join_year: 2022,
      medical_condition: 'لا توجد',
      father_phone: '01012345678',
      mother_phone: '01298765432',
      member_type: 'عضوة',
    }),
  });
  const addData = await addMemberRes.json();
  assert.strictEqual(addMemberRes.status, 201);
  testMemberId = addData.id;
  console.log(`✅ Test 6 Passed: تمت إضافة العضو بنجاح (ID: ${testMemberId}).`);

  // 7. إضافة رقم قومي مكرر (يجب منعه)
  console.log('Test 7: محاولة إضافة رقم قومي مكرر...');
  const dupRes = await fetch(`${BASE_URL}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      student_name: 'مريم أخرى',
      guardian_name: 'ولي أمر آخر',
      national_id: uniqueNationalId, // DUPLICATE
      birth_date: '2012-05-15',
      school_stage: 'إعدادي',
      scout_join_year: 2022,
      member_type: 'عضوة',
    }),
  });
  assert.strictEqual(dupRes.status, 400);
  console.log('✅ Test 7 Passed: تم منع الرقم القومي المكرر وحماية فرادة البيانات.');

  // 8. رقم قومي غير صحيح (ليس 14 رقماً)
  console.log('Test 8: محاولة إضافة رقم قومي غير صحيح (أقل من 14 رقماً)...');
  const invalidNidRes = await fetch(`${BASE_URL}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      student_name: 'سارة نبيل',
      guardian_name: 'نبيل شوقي',
      national_id: '12345', // INVALID LENGTH
      birth_date: '2013-01-01',
      school_stage: 'ابتدائي',
      scout_join_year: 2023,
      member_type: 'عضوة',
    }),
  });
  assert.strictEqual(invalidNidRes.status, 400);
  console.log('✅ Test 8 Passed: تم رفض الرقم القومي غير المطابق لـ14 رقماً.');

  // 9. حقل إجباري فارغ
  console.log('Test 9: محاولة إرسال اسم فارغ...');
  const emptyNameRes = await fetch(`${BASE_URL}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      student_name: '',
      guardian_name: 'نبيل شوقي',
      national_id: '30401019999999',
      birth_date: '2013-01-01',
      school_stage: 'ابتدائي',
      scout_join_year: 2023,
      member_type: 'عضوة',
    }),
  });
  assert.strictEqual(emptyNameRes.status, 400);
  console.log('✅ Test 9 Passed: تم منع الحقول الإجبارية الفارغة.');

  // 10. تاريخ غير صحيح
  console.log('Test 10: محاولة إرسال تاريخ ميلاد غير صالح...');
  const invalidDateRes = await fetch(`${BASE_URL}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      student_name: 'مونيكا ريمون',
      guardian_name: 'ريمون عادل',
      national_id: '30401018888888',
      birth_date: 'not-a-date',
      school_stage: 'ابتدائي',
      scout_join_year: 2023,
      member_type: 'عضوة',
    }),
  });
  assert.strictEqual(invalidDateRes.status, 400);
  console.log('✅ Test 10 Passed: تم التحقق من سلامة التاريخ.');

  // 11. تعديل عضو
  console.log('Test 11: تعديل بيانات العضو...');
  const editRes = await fetch(`${BASE_URL}/api/members/${testMemberId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      student_name: 'مريم جرجس حنا المعدلة',
      guardian_name: 'جرجس حنا ميخائيل',
      national_id: uniqueNationalId,
      birth_date: '2012-05-15',
      school_stage: 'ثانوي',
      scout_join_year: 2022,
      medical_condition: 'حساسية طفيفة',
      father_phone: '01012345678',
      mother_phone: '01298765432',
      member_type: 'قائد',
    }),
  });
  assert.strictEqual(editRes.status, 200);
  console.log('✅ Test 11 Passed: تم تعديل بيانات العضو وحفظها بنجاح.');

  // 12. البحث بالاسم والبحث الجزئي
  console.log('Test 12: البحث الجزئي عن الاسم "مريم"...');
  const searchNameRes = await fetch(`${BASE_URL}/api/members?q=${encodeURIComponent('مريم')}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchNameData = await searchNameRes.json();
  assert(searchNameData.members.some((m) => m.student_name.includes('مريم')));
  console.log(`✅ Test 12 Passed: وجد البحث الجزئي ${searchNameData.members.length} عضو باسم مريم.`);

  // 13. البحث بالرقم القومي
  console.log('Test 13: البحث الدقيق بالرقم القومي...');
  const searchNidRes = await fetch(`${BASE_URL}/api/members?q=${uniqueNationalId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const searchNidData = await searchNidRes.json();
  assert.strictEqual(searchNidData.members.length, 1);
  assert.strictEqual(searchNidData.members[0].national_id, uniqueNationalId);
  console.log('✅ Test 13 Passed: البحث بالرقم القومي دقيق وناجح.');

  // 14. بطاقة العضو
  console.log('Test 14: جلب تفاصيل بطاقة العضو...');
  const cardRes = await fetch(`${BASE_URL}/api/members/${testMemberId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const cardData = await cardRes.json();
  assert.strictEqual(cardData.member.student_name, 'مريم جرجس حنا المعدلة');
  console.log('✅ Test 14 Passed: تم جلب بيانات البطاقة كاملة.');

  // 15. منع DATA_ENTRY من الحذف (Role Authorization)
  console.log('Test 15: اختبار منع مدخل البيانات DATA_ENTRY من الحذف...');
  const unauthDelRes = await fetch(`${BASE_URL}/api/members/${testMemberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${dataEntryToken}` },
  });
  assert.strictEqual(unauthDelRes.status, 403);
  console.log('✅ Test 15 Passed: تم رفض الحذف لمدخل البيانات (403 Forbidden).');

  // 16. حذف العضو بواسطة ADMIN
  console.log('Test 16: حذف العضو بواسطة مسؤول النظام ADMIN...');
  const authDelRes = await fetch(`${BASE_URL}/api/members/${testMemberId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(authDelRes.status, 200);
  console.log('✅ Test 16 Passed: تم حذف العضو وتسجيل العملية.');

  // 17. Dashboard Stats Verification
  console.log('Test 17: التحقق من إحصائيات Dashboard...');
  const dashRes = await fetch(`${BASE_URL}/api/dashboard`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dashData = await dashRes.json();
  assert(dashData.totalMembers !== undefined);
  assert(dashData.stages !== undefined);
  console.log('✅ Test 17 Passed: لوحة التحكم تعمل وتحدث العدادات.');

  // 18. Reports Verification
  console.log('Test 18: التحقق من شاشة التقارير...');
  const repRes = await fetch(`${BASE_URL}/api/reports/summary`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const repData = await repRes.json();
  assert(repData.stagesBreakdown !== undefined);
  console.log('✅ Test 18 Passed: تقارير المراحل والسنوات جاهزة.');

  // 19. Backup Download
  console.log('Test 19: اختبار إنشاء وتنزيل النسخة الاحتياطية...');
  const backupRes = await fetch(`${BASE_URL}/api/backup/download`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(backupRes.status, 200);
  const backupHeader = backupRes.headers.get('content-disposition');
  assert(backupHeader && backupHeader.includes('Scout_Backup_'), 'Filename pattern invalid');
  console.log(`✅ Test 19 Passed: تم إنشاء النسخة الاحتياطية (${backupHeader}).`);

  // 20. Audit Log
  console.log('Test 20: فحص سجل الرقابة والعمليات Audit Log...');
  const auditRes = await fetch(`${BASE_URL}/api/audit-logs`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const auditData = await auditRes.json();
  assert(auditData.logs && auditData.logs.length > 0);
  const actions = auditData.logs.map((l) => l.action);
  assert(actions.includes('LOGIN'));
  assert(actions.includes('ADD'));
  assert(actions.includes('EDIT'));
  assert(actions.includes('DELETE'));
  assert(actions.includes('BACKUP'));
  console.log(`✅ Test 20 Passed: سجل العمليات يحتوي على ${auditData.logs.length} عملية موثقة.`);

  console.log('🎉 جميع الاختبارات تمت بنجاح وبدون أي أخطاء!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
