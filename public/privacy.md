# Privacy Policy — Pocket Stylist

**Last updated:** 2026-06-18
**Controller:** Pocket Stylist — sole proprietor, contact via `/feedback` in-app
or `sburmych@gmail.com`.

This document explains, in plain language, what personal data the **Pocket
Stylist** web app (`https://pocket-stylist-production.up.railway.app`) collects
about you, why, and what you can do about it. It is written to comply with
the EU **GDPR** (Regulation 2016/679) and Ukrainian Law «Про захист
персональних даних».

Українська версія нижче ↓

---

## 1. What we collect

| Data | When | Why |
|------|------|-----|
| Email address | At sign-up (email or Google OAuth) | To identify your account and let you log back in |
| Display name (optional) | At sign-up | UI personalisation only |
| Password (hashed) | At sign-up via email | scrypt-hashed, never stored in plain text |
| Google profile picture URL | Google OAuth only | Avatar in the top-right corner |
| Google `googleId` (subject) | Google OAuth only | To link your Google identity to your account |
| Google `access_token` / `refresh_token` | If you grant Drive permission | To list and download photos you pick via Google Drive Picker. We can only read files you explicitly select with `drive.file` scope. |
| Photos you upload (clothing items, optional selfie for colour analysis) | When you import or scan an item | AI categorisation (Gemini) + outfit composition |
| Wardrobe metadata (category, colour, fabric, season, brand) | Derived from your photos | Outfit recommendations and analytics |
| Approximate geolocation (lat/lon) | Only if you allow it in the Styling page | Weather-aware outfit suggestions |
| Feedback you send via the in-app widget | When you submit feedback | Product improvement |
| Technical logs (IP, user-agent, request paths) | On every API call | Security, debugging — retained ≤30 days on Railway |

We do **not** collect: phone number, financial data, biometric face vectors,
contacts list, browsing history outside the app.

## 2. Where the data lives

| Service | What it stores | Region |
|---------|----------------|--------|
| Railway (Postgres + Express app) | User row, wardrobe metadata, feedback | US East (Virginia) |
| Cloudinary (when configured) | Compressed clothing photos | EU & US edges |
| Google Generative AI (Gemini 2.5 Flash) | Photos sent for analysis are processed in-memory and not retained by Google for training (per Google's API terms). We do not send photos containing identifiable faces unless you explicitly use the colour-analysis selfie feature. |
| OpenWeatherMap (when configured) | Latitude/longitude only, never anything personal | EU |

## 3. Lawful basis

- **Performance of a contract** (Art. 6(1)(b) GDPR) — to deliver the wardrobe
  service you signed up for.
- **Consent** (Art. 6(1)(a) GDPR) — for optional features (Google Drive
  access, selfie colour analysis, geolocation). You can withdraw at any
  time without affecting other features.
- **Legitimate interest** (Art. 6(1)(f) GDPR) — for security logs.

## 4. Retention

- Account data lives until you delete your account (see §7).
- Server logs are deleted after **30 days**.
- Feedback messages are kept until acted on, then deleted.

## 5. Sharing

We do **not** sell or rent your data. We share data only with the processors
listed in §2, each bound by their own privacy terms. No analytics SDKs (no
Google Analytics, no Meta Pixel, no Mixpanel) are loaded by the app.

## 6. International transfers

Some processors (Cloudinary, Google) operate in the US. Transfers rely on
the **EU–US Data Privacy Framework** and SCCs.

## 7. Your rights

Under GDPR you have the right to:

- **Access** your data — download via "Profile → Export my data" *(coming
  soon)* or by emailing the controller.
- **Rectify** inaccurate data — edit it in-app or email us.
- **Erase** your account — coming soon as a self-service button; meanwhile
  email the controller.
- **Restrict** or **object** to processing.
- **Data portability** — JSON export.
- **Lodge a complaint** with your local Data Protection Authority (in
  Ukraine: Уповноважений Верховної Ради України з прав людини).

We respond to verified requests within **30 days**.

## 8. Children

Pocket Stylist is not intended for users under 16. We do not knowingly
collect data from minors. If you believe we have, please contact us.

## 9. Cookies / local storage

We use **localStorage** to keep your JWT login token and your language
preference. No third-party tracking cookies are set.

## 10. Changes

We will publish updates here and timestamp them. Material changes will be
notified by email.

---

# Політика конфіденційності — Pocket Stylist (UA)

**Оновлено:** 2026-06-18
**Володілець бази:** ФОП-розробник, контакт через `/feedback` в додатку або
`sburmych@gmail.com`.

## 1. Які дані ми збираємо

| Дані | Коли | Навіщо |
|------|------|--------|
| Email | При реєстрації (email або Google OAuth) | Ідентифікація та відновлення доступу |
| Імʼя (опц.) | При реєстрації | Персоналізація UI |
| Пароль (хешований) | При email-реєстрації | scrypt-хеш, ніколи не зберігається у відкритому вигляді |
| Аватар Google | При Google OAuth | Лише відображення в куті |
| `googleId` | При Google OAuth | Звʼязування Google-акаунту з вашим |
| Google `access_token`/`refresh_token` | Якщо ви даєте дозвіл на Drive | Списувати та завантажувати фото, які ви явно обрали через Picker. Scope `drive.file` — ми бачимо лише обрані вами файли. |
| Фото одягу (та опц. селфі для аналізу колориту) | При імпорті / скануванні | AI-категоризація (Gemini) + підбір образів |
| Метадані гардеробу (категорія, колір, тканина, сезон, бренд) | Генеруються з фото | Підбір образів і аналітика |
| Приблизна геолокація (lat/lon) | Лише за вашим дозволом на сторінці «Стиль» | Підбір образу з урахуванням погоди |
| Зворотний звʼязок | Коли ви надсилаєте через віджет | Покращення продукту |
| Технічні логи (IP, user-agent, шляхи запитів) | На кожен API-виклик | Безпека, дебаг — зберігаються ≤30 днів |

Ми **не** збираємо: телефон, фінансові дані, біометричні вектори обличчя,
контакти, історію переглядів поза додатком.

## 2. Де зберігаються дані

| Сервіс | Що зберігається | Регіон |
|--------|-----------------|--------|
| Railway (Postgres + Express) | Запис користувача, метадані гардеробу, зворотний звʼязок | US East (Virginia) |
| Cloudinary (коли підключено) | Стиснуті фото одягу | EU + US edges |
| Google Generative AI (Gemini 2.5 Flash) | Фото обробляються тимчасово, не використовуються Google для тренування (за умовами API). Селфі для аналізу колориту передаються тільки якщо ви явно це активуєте. |
| OpenWeatherMap (коли підключено) | Лише lat/lon, нічого особистого | EU |

## 3. Правова підстава

- **Виконання договору** (ст. 6(1)(b) GDPR) — для надання сервісу.
- **Згода** (ст. 6(1)(a) GDPR) — для опційних функцій (Google Drive, селфі,
  геолокація). Ви можете відкликати її будь-коли.
- **Законний інтерес** (ст. 6(1)(f) GDPR) — для логів безпеки.

## 4. Термін зберігання

- Дані акаунту — поки ви не видалите акаунт.
- Серверні логи — **30 днів**, потім видаляються.
- Повідомлення зворотного звʼязку — до обробки, потім видаляються.

## 5. Передача третім сторонам

Ми **не продаємо** ваші дані. Передаємо лише процесорам у §2. Аналітичні
SDK (Google Analytics, Meta Pixel, Mixpanel) не використовуються.

## 6. Міжнародна передача

Cloudinary і Google працюють у США. Підстава — **EU–US Data Privacy
Framework** та SCC.

## 7. Ваші права (GDPR)

- **Доступ** до своїх даних — експорт *(скоро)*; зараз — лист на контакт.
- **Виправлення** неточних даних — у додатку або листом.
- **Видалення** акаунту — скоро як кнопка; зараз — листом.
- **Обмеження** або **заперечення** проти обробки.
- **Перенесення даних** — JSON-експорт.
- **Скарга** до вашого DPA (в Україні — Уповноважений ВРУ з прав людини).

Ми відповідаємо протягом **30 днів**.

## 8. Діти

Сервіс не призначений для користувачів молодше 16 років.

## 9. Куки / localStorage

Ми використовуємо **localStorage** для JWT-токену та мови. Сторонні
трекінгові куки не встановлюємо.

## 10. Зміни

Оновлення публікуються тут із датою. Про істотні зміни сповіщаємо email.
