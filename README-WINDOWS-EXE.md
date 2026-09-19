# دليل تشغيل وتوليد ملف EXE لنظام إدارة الكشافة على Windows

هذا الدليل يوضح خطوات تنزيل المشروع كملف مضغوط وتوليد ملف تنفيذي **EXE** يعمل بشكل مستقل ومحلي بالكامل على نظام **Windows**.

---

## الخطوة 1: تنزيل المشروع من الموقع (Download ZIP)
1. من أعلى واجهة المنصة (Google AI Studio)، اضغط على زر **Settings / القائمة الرئيسية**.
2. اختر **Export to ZIP** أو **Download Code**.
3. قم بفك ضغط الملف (Extract All) في أي مجلد على جهاز الكمبيوتر الخاص بك (مثلاً `C:\ScoutSystem`).

---

## الخطوة 2: التشغيل الفوري بنقرة واحدة (One-Click Run)
يحتوي المجلد المرفق على ملف تشغيل مخصص للويندوز:
- فقط اضغط مرتين على الملف: **`تشغيل_النظام_Start.bat`**
- سيقوم تلقائياً بتثبيت التبعيات وتشغيل الخادم المحلي وفتح النظام في المتصفح على: `http://localhost:3000`.

---

## الخطوة 3: توليد ملف EXE تنفيذي مستقل (Native Windows Application)

إذا أردت تحويله إلى برنامج مكتبي تنفيذي مستقل (`.exe`) بنافذة وسطح مكتب خاص:

### الطريقة الأسهل والأسرع (باستخدام Electron Builder):
1. افتح موجه الأوامر (CMD أو PowerShell) داخل مجلد المشروع.
2. قم بتثبيت حزم Electron:
   ```bash
   npm install --save-dev electron electron-builder concurrently wait-on
   ```
3. أضف ملف `electron-main.cjs` التالي في مجلد المشروع:
   ```javascript
   const { app, BrowserWindow } = require('electron');
   const path = require('path');
   const { spawn } = require('child_process');

   let mainWindow;
   let serverProcess;

   function createWindow() {
     mainWindow = new BrowserWindow({
       width: 1280,
       height: 800,
       title: 'نظام إدارة الكشافة - مدرسة القديس يوسف بالعبور',
       webPreferences: {
         nodeIntegration: false,
         contextIsolation: true
       }
     });

     mainWindow.loadURL('http://localhost:3000');
     mainWindow.on('closed', () => { mainWindow = null; });
   }

   app.whenReady().then(() => {
     // تشغيل خادم Node المحلي داخلياً
     serverProcess = spawn('node', [path.join(__dirname, 'dist', 'server.cjs')], {
       stdio: 'inherit'
     });

     setTimeout(createWindow, 2000);
   });

   app.on('window-all-closed', () => {
     if (serverProcess) serverProcess.kill();
     if (process.platform !== 'darwin') app.quit();
   });
   ```

4. لبناء ملف الـ **`.exe`** المستقل:
   ```bash
   npx electron-builder --win
   ```
   ستجد ملف الـ **`ScoutSystem Setup 1.0.0.exe`** جاهزاً داخل مجلد `dist/` للتثبيت والتشغيل على أي جهاز يعمل بنظام Windows دون الحاجة للاتصال بالإنترنت!
