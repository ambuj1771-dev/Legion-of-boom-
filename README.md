# The One Journal — Hosting Guide (हिंदी में)

यह फ़ोल्डर अब एक **पूरा React project** है, सिर्फ़ एक file नहीं। इसे real website बनाने के लिए नीचे दिए steps follow करें।

## ज़रूरी जानकारी — पढ़ें पहले

- Login password अभी भी code में लिखा है (`src/App.jsx` में `ADMIN_PASSWORD`). असली security के लिए इसे server-side login से replace करना होगा — अभी के लिए सिर्फ़ एक basic gate है।
- Articles अभी **browser की localStorage** में save होते हैं — मतलब हर visitor के अपने browser में अलग data होगा। आपके फ़ोन और लैपटॉप पर अलग-अलग articles दिखेंगे जब तक एक real database (जैसे Supabase या Firebase) नहीं जोड़ा जाता।
- Demo password: `wire2026` — चाहें तो इसे बदल सकते हैं `src/App.jsx` की पहली कुछ lines में।

---

## Step 1: GitHub account बनाएं
1. https://github.com पर जाएं और free account बनाएं (अगर नहीं है)

## Step 2: इस project को GitHub पर डालें
1. GitHub पर एक **नया repository** बनाएं (नाम दें जैसे `the-one-journal`)
2. इस पूरे folder (`the-one-journal`) को upload करें — GitHub website से directly "uploading an existing file" option से भी कर सकते हैं, या git कमांड से:
   ```
   git init
   git add .
   git commit -m "first version"
   git remote add origin <आपकी GitHub repo का link>
   git push -u origin main
   ```

## Step 3: Vercel पर deploy करें
1. https://vercel.com पर जाएं, GitHub से sign up करें (free)
2. "Add New Project" दबाएं
3. अपनी GitHub repository चुनें (`the-one-journal`)
4. Vercel खुद-ब-खुद समझ जाएगा कि यह Vite project है — कुछ change करने की ज़रूरत नहीं
5. "Deploy" दबाएं

कुछ ही seconds में आपको एक **live link** मिल जाएगा, जैसे:
`https://the-one-journal.vercel.app`

यही आपकी **live website** है — कोई भी इस link से इसे खोल सकता है।

---

## आगे क्या करें (असली site के लिए ज़रूरी)

1. **Real database जोड़ें** — ताकि articles सब devices पर एक जैसे दिखें
   - Supabase (https://supabase.com) — free tier है, beginner-friendly
2. **Real login system** — ताकि password code में visible न हो
   - Supabase Auth या Firebase Auth इसके लिए अच्छे हैं
3. **Custom domain** (optional) — जैसे `theonejournal.com`, अलग से खरीदना होगा (~₹700-1000/साल), फिर Vercel की settings में जोड़ देना होता है

ये तीनों चीज़ें अगला step हैं — जब ready हों तो बताएं, साथ में बना देंगे।
