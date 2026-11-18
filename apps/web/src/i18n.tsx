import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// Ukrainian text is the key; English and Russian translate it. {name} marks a substituted value.
export const LOCALES = ['uk', 'en', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { uk: 'Українська', en: 'English', ru: 'Русский' };

type Dict = Record<string, string>;

const en: Dict = {
  'Помилка сервера': 'Server error',
  'Не вдалося увійти': 'Could not sign in',
  'Спробувати ще раз': 'Try again',
  'Завантаження…': 'Loading…',
  'FoodLog поки недоступний для вашого акаунта': 'FoodLog is not available for your account yet',
  'Попросіть адміністратора Only Tools відкрити доступ.': 'Ask the Only Tools admin to give you access.',
  'До Only Tools': 'Go to Only Tools',
  'Сьогодні': 'Today',
  'Вчора': 'Yesterday',
  'Завтра': 'Tomorrow',
  'Каталог': 'Catalog',
  'Статистика': 'Stats',
  'Профіль': 'Profile',
  'Розділи': 'Sections',
  'Додати їжу': 'Add food',
  'Сніданок': 'Breakfast',
  'Обід': 'Lunch',
  'Вечеря': 'Dinner',
  'Перекус': 'Snack',
  'Щось пішло не так': 'Something went wrong',
  'ккал': 'kcal',
  'г': 'g',
  'кг': 'kg',
  'Б': 'P',
  'Ж': 'F',
  'В': 'C',
  'Мої продукти': 'My products',
  'Новий': 'New',
  'на 100 г': 'per 100 g',
  'Видалити {name}': 'Delete {name}',
  'Видалити «{name}»? Записи в щоденнику залишаться.': 'Delete “{name}”? Diary entries stay.',
  'Тут будуть продукти, які ви створите самі. Решту шукайте через «+» — каталог Open Food Facts.':
    'Products you create yourself show up here. Find everything else with “+” in the Open Food Facts catalog.',
  'Дані про продукти: Open Food Facts (ODbL).': 'Product data: Open Food Facts (ODbL).',
  'Штрихкод {code} не схожий на товарний. Спробуйте ще раз.': 'Barcode {code} does not look like a product code. Try again.',
  'Назад': 'Back',
  'Назва продукту або штрихкод': 'Product name or barcode',
  'Сканувати штрихкод': 'Scan barcode',
  'Нещодавні': 'Recent',
  'Мій продукт': 'My product',
  '/100г': '/100g',
  'Нічого не знайдено.': 'Nothing found.',
  'Тут з’являться продукти, які ви нещодавно додавали.': 'Products you added recently will appear here.',
  'Створити свій продукт': 'Create your own product',
  'Введіть калорії та БЖУ з етикетки': 'Enter calories and macros from the label',
  'На 100 г': 'Per 100 g',
  'Скільки грамів': 'How many grams',
  '(порція)': '(serving)',
  'Додаю…': 'Adding…',
  'Додати в «{meal}»': 'Add to {meal}',
  'Немає доступу до камери. Дозвольте його в налаштуваннях браузера.': 'No camera access. Allow it in your browser settings.',
  'Не вдалося увімкнути камеру.': 'Could not turn on the camera.',
  'Наведіть на штрихкод': 'Point at the barcode',
  'Закрити': 'Close',
  'Тиждень': 'Week',
  'Місяць': 'Month',
  'ккал у середньому за день': 'kcal per day on average',
  'ціль': 'target',
  'г у середньому': 'g on average',
  'днів із записами': 'days logged',
  'Вага': 'Weight',
  'Вага сьогодні, кг': 'Weight today, kg',
  'Зберегти': 'Save',
  'Перевірте поля': 'Check the fields',
  'Новий продукт': 'New product',
  'Назва': 'Name',
  'Наприклад, Сир кисломолочний 5%': 'For example, Cottage cheese 5%',
  'Виробник (необовʼязково)': 'Brand (optional)',
  'Штрихкод (необовʼязково)': 'Barcode (optional)',
  'Ккал': 'Kcal',
  'Білки, г': 'Protein, g',
  'Жири, г': 'Fat, g',
  'Вуглеводи, г': 'Carbs, g',
  'За БЖУ виходить ≈{kcal} ккал. Перевірте етикетку.': 'Macros add up to ≈{kcal} kcal. Check the label.',
  'Порція, г (необовʼязково)': 'Serving, g (optional)',
  'Зберігаю…': 'Saving…',
  'Збережено': 'Saved',
  'Сидячий спосіб життя': 'Sedentary',
  'Легка активність (1–3 тренування)': 'Light (1–3 workouts a week)',
  'Середня (3–5 тренувань)': 'Moderate (3–5 workouts)',
  'Висока (6–7 тренувань)': 'Active (6–7 workouts)',
  'Дуже висока (фізична робота)': 'Very active (physical job)',
  'Схуднути': 'Lose weight',
  'Тримати вагу': 'Maintain weight',
  'Набрати масу': 'Gain weight',
  'Денна ціль': 'Daily target',
  'Параметри': 'Body',
  'Чоловік': 'Male',
  'Жінка': 'Female',
  'Рік народження': 'Birth year',
  'Зріст, см': 'Height, cm',
  'Вага, кг': 'Weight, kg',
  'Активність': 'Activity',
  'Мета': 'Goal',
  'Задати ціль вручну': 'Set the target manually',
  'Ціль рахуємо за формулою Міффліна–Сан Жеора і оновлюємо, коли ви записуєте нову вагу.':
    'The target uses the Mifflin–St Jeor formula and updates when you log a new weight.',
  'Акаунт': 'Account',
  'Мова': 'Language',
  'Інші інструменти Only Tools': 'Other Only Tools apps',
  'Вийти': 'Sign out',
  'Видалити весь щоденник, вагу, профіль і ваші продукти у FoodLog? Акаунт Only Tools залишиться.':
    'Delete your whole FoodLog diary, weight log, profile and products? Your Only Tools account stays.',
  'Видалити мої дані FoodLog': 'Delete my FoodLog data',
  'Попередній день': 'Previous day',
  'Наступний день': 'Next day',
  'з {kcal} ккал': 'of {kcal} kcal',
  'Білки': 'Protein',
  'Жири': 'Fat',
  'Вуглеводи': 'Carbs',
  'Встановіть денну ціль': 'Set a daily target',
  'Розрахуємо калорії та БЖУ за вашими параметрами': 'We will calculate calories and macros from your body data',
  'Додати до «{meal}»': 'Add to {meal}',
  'Грами': 'Grams',
  'Видалити': 'Delete',
};

const ru: Dict = {
  'Помилка сервера': 'Ошибка сервера',
  'Не вдалося увійти': 'Не удалось войти',
  'Спробувати ще раз': 'Попробовать ещё раз',
  'Завантаження…': 'Загрузка…',
  'FoodLog поки недоступний для вашого акаунта': 'FoodLog пока недоступен для вашего аккаунта',
  'Попросіть адміністратора Only Tools відкрити доступ.': 'Попросите администратора Only Tools открыть доступ.',
  'До Only Tools': 'В Only Tools',
  'Сьогодні': 'Сегодня',
  'Вчора': 'Вчера',
  'Завтра': 'Завтра',
  'Каталог': 'Каталог',
  'Статистика': 'Статистика',
  'Профіль': 'Профиль',
  'Розділи': 'Разделы',
  'Додати їжу': 'Добавить еду',
  'Сніданок': 'Завтрак',
  'Обід': 'Обед',
  'Вечеря': 'Ужин',
  'Перекус': 'Перекус',
  'Щось пішло не так': 'Что-то пошло не так',
  'ккал': 'ккал',
  'г': 'г',
  'кг': 'кг',
  'Б': 'Б',
  'Ж': 'Ж',
  'В': 'У',
  'Мої продукти': 'Мои продукты',
  'Новий': 'Новый',
  'на 100 г': 'на 100 г',
  'Видалити {name}': 'Удалить {name}',
  'Видалити «{name}»? Записи в щоденнику залишаться.': 'Удалить «{name}»? Записи в дневнике останутся.',
  'Тут будуть продукти, які ви створите самі. Решту шукайте через «+» — каталог Open Food Facts.':
    'Здесь будут продукты, которые вы создадите сами. Остальное ищите через «+» — каталог Open Food Facts.',
  'Дані про продукти: Open Food Facts (ODbL).': 'Данные о продуктах: Open Food Facts (ODbL).',
  'Штрихкод {code} не схожий на товарний. Спробуйте ще раз.': 'Штрихкод {code} не похож на товарный. Попробуйте ещё раз.',
  'Назад': 'Назад',
  'Назва продукту або штрихкод': 'Название продукта или штрихкод',
  'Сканувати штрихкод': 'Сканировать штрихкод',
  'Нещодавні': 'Недавние',
  'Мій продукт': 'Мой продукт',
  '/100г': '/100г',
  'Нічого не знайдено.': 'Ничего не найдено.',
  'Тут з’являться продукти, які ви нещодавно додавали.': 'Здесь появятся продукты, которые вы недавно добавляли.',
  'Створити свій продукт': 'Создать свой продукт',
  'Введіть калорії та БЖУ з етикетки': 'Введите калории и БЖУ с этикетки',
  'На 100 г': 'На 100 г',
  'Скільки грамів': 'Сколько граммов',
  '(порція)': '(порция)',
  'Додаю…': 'Добавляю…',
  'Додати в «{meal}»': 'Добавить в «{meal}»',
  'Немає доступу до камери. Дозвольте його в налаштуваннях браузера.': 'Нет доступа к камере. Разрешите его в настройках браузера.',
  'Не вдалося увімкнути камеру.': 'Не удалось включить камеру.',
  'Наведіть на штрихкод': 'Наведите на штрихкод',
  'Закрити': 'Закрыть',
  'Тиждень': 'Неделя',
  'Місяць': 'Месяц',
  'ккал у середньому за день': 'ккал в среднем за день',
  'ціль': 'цель',
  'г у середньому': 'г в среднем',
  'днів із записами': 'дней с записями',
  'Вага': 'Вес',
  'Вага сьогодні, кг': 'Вес сегодня, кг',
  'Зберегти': 'Сохранить',
  'Перевірте поля': 'Проверьте поля',
  'Новий продукт': 'Новый продукт',
  'Назва': 'Название',
  'Наприклад, Сир кисломолочний 5%': 'Например, Творог 5%',
  'Виробник (необовʼязково)': 'Производитель (необязательно)',
  'Штрихкод (необовʼязково)': 'Штрихкод (необязательно)',
  'Ккал': 'Ккал',
  'Білки, г': 'Белки, г',
  'Жири, г': 'Жиры, г',
  'Вуглеводи, г': 'Углеводы, г',
  'За БЖУ виходить ≈{kcal} ккал. Перевірте етикетку.': 'По БЖУ выходит ≈{kcal} ккал. Проверьте этикетку.',
  'Порція, г (необовʼязково)': 'Порция, г (необязательно)',
  'Зберігаю…': 'Сохраняю…',
  'Збережено': 'Сохранено',
  'Сидячий спосіб життя': 'Сидячий образ жизни',
  'Легка активність (1–3 тренування)': 'Лёгкая активность (1–3 тренировки)',
  'Середня (3–5 тренувань)': 'Средняя (3–5 тренировок)',
  'Висока (6–7 тренувань)': 'Высокая (6–7 тренировок)',
  'Дуже висока (фізична робота)': 'Очень высокая (физическая работа)',
  'Схуднути': 'Похудеть',
  'Тримати вагу': 'Держать вес',
  'Набрати масу': 'Набрать массу',
  'Денна ціль': 'Дневная цель',
  'Параметри': 'Параметры',
  'Чоловік': 'Мужчина',
  'Жінка': 'Женщина',
  'Рік народження': 'Год рождения',
  'Зріст, см': 'Рост, см',
  'Вага, кг': 'Вес, кг',
  'Активність': 'Активность',
  'Мета': 'Цель',
  'Задати ціль вручну': 'Задать цель вручную',
  'Ціль рахуємо за формулою Міффліна–Сан Жеора і оновлюємо, коли ви записуєте нову вагу.':
    'Цель считаем по формуле Миффлина–Сан Жеора и обновляем, когда вы записываете новый вес.',
  'Акаунт': 'Аккаунт',
  'Мова': 'Язык',
  'Інші інструменти Only Tools': 'Другие инструменты Only Tools',
  'Вийти': 'Выйти',
  'Видалити весь щоденник, вагу, профіль і ваші продукти у FoodLog? Акаунт Only Tools залишиться.':
    'Удалить весь дневник, вес, профиль и ваши продукты в FoodLog? Аккаунт Only Tools останется.',
  'Видалити мої дані FoodLog': 'Удалить мои данные FoodLog',
  'Попередній день': 'Предыдущий день',
  'Наступний день': 'Следующий день',
  'з {kcal} ккал': 'из {kcal} ккал',
  'Білки': 'Белки',
  'Жири': 'Жиры',
  'Вуглеводи': 'Углеводы',
  'Встановіть денну ціль': 'Установите дневную цель',
  'Розрахуємо калорії та БЖУ за вашими параметрами': 'Рассчитаем калории и БЖУ по вашим параметрам',
  'Додати до «{meal}»': 'Добавить в «{meal}»',
  'Грами': 'Граммы',
  'Видалити': 'Удалить',
};

const DICTS: Record<Locale, Dict | null> = { uk: null, en, ru };
const STORAGE_KEY = 'onlytools.locale';

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (LOCALES as readonly string[]).includes(saved)) return saved as Locale;
  } catch {
    /* storage blocked: fall back to the browser */
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const base = lang.toLowerCase().split('-')[0];
    if (base === 'uk' || base === 'ru' || base === 'en') return base;
  }
  return 'en';
}

let current: Locale = 'uk';
/** Translates with the active locale; the app remounts on a locale change, so plain functions can use it. */
export const tr = (text: string, vars?: Record<string, string | number>) => translate(current, text, vars);
export const activeLocale = () => current;

/** Translates a Ukrainian source string; {name} placeholders take values from `vars`. */
export function translate(locale: Locale, text: string, vars?: Record<string, string | number>): string {
  const out = DICTS[locale]?.[text] ?? text;
  return vars ? out.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : out;
}

type I18n = { locale: Locale; setLocale: (l: Locale) => void; t: (text: string, vars?: Record<string, string | number>) => string };
const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectLocale);
  current = locale;
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* not persisted; still switches for this visit */
    }
    current = l;
    setLocaleState(l);
  }, []);
  const value = useMemo<I18n>(() => ({ locale, setLocale, t: (text, vars) => translate(locale, text, vars) }), [locale, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside I18nProvider');
  return v;
}

/** BCP-47 tag for number and date formatting. */
export const intlTag = (l: Locale) => ({ uk: 'uk-UA', en: 'en-GB', ru: 'ru-RU' })[l];
