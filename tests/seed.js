const BASE_URL = 'http://localhost:3000';

async function seed() {
  // Login as admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  const { token } = await loginRes.json();

  const membersCheck = await fetch(`${BASE_URL}/api/members`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const { members } = await membersCheck.json();

  if (members && members.length > 0) {
    console.log(`قاعدة البيانات تحتوي بالفعل على ${members.length} عضو.`);
    return;
  }

  const initialMembers = [
    {
      student_name: 'كلارا فادي جورج',
      guardian_name: 'فادي جورج نسيم',
      national_id: '30904120102456',
      birth_date: '2009-04-12',
      school_stage: 'ثانوي',
      scout_join_year: 2018,
      medical_condition: '',
      father_phone: '01221456789',
      mother_phone: '01009876543',
      member_type: 'قائد',
    },
    {
      student_name: 'ساندرا أمير سامي',
      guardian_name: 'أمير سامي توفيق',
      national_id: '31108200103578',
      birth_date: '2011-08-20',
      school_stage: 'إعدادي',
      scout_join_year: 2021,
      medical_condition: 'حساسية طفيفة من الفراولة',
      father_phone: '01011223344',
      mother_phone: '01122334455',
      member_type: 'عضوة',
    },
    {
      student_name: 'جولي مدحت شفيق',
      guardian_name: 'مدحت شفيق نجيب',
      national_id: '31402150104689',
      birth_date: '2014-02-15',
      school_stage: 'ابتدائي',
      scout_join_year: 2023,
      medical_condition: '',
      father_phone: '01233445566',
      mother_phone: '01044556677',
      member_type: 'عضوة',
    },
    {
      student_name: 'مارينا يوسف إبراهيم',
      guardian_name: 'يوسف إبراهيم بطرس',
      national_id: '30511100101234',
      birth_date: '2005-11-10',
      school_stage: 'جامعة',
      scout_join_year: 2015,
      medical_condition: '',
      father_phone: '01066778899',
      mother_phone: '01277889900',
      member_type: 'قائد',
    },
    {
      student_name: 'كارين مايكل صفوت',
      guardian_name: 'مايكل صفوت غالي',
      national_id: '31206050107890',
      birth_date: '2012-06-05',
      school_stage: 'إعدادي',
      scout_join_year: 2022,
      medical_condition: 'ربو شعبي خفيف عند الجري الشديد',
      father_phone: '01188990011',
      mother_phone: '01599001122',
      member_type: 'عضوة',
    },
  ];

  for (const m of initialMembers) {
    await fetch(`${BASE_URL}/api/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(m),
    });
  }

  console.log('✅ تم إضافة البيانات التأسيسية لكشافة مدرسة القديس يوسف بالعبور بنجاح.');
}

seed().catch(console.error);
