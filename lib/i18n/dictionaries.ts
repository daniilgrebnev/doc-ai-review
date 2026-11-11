export type Locale = "en" | "ru";

export const LOCALES: Locale[] = ["en", "ru"];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "agentflow-locale";

type Dict = Record<string, string>;

const en: Dict = {
  "meta.title": "AgentFlow — Document Approval",
  "meta.description":
    "Multi-agent document approval. Lawyer, finance, security, and PM experts review your document sequentially.",
  "app.tagline": "Document approval",
  "app.nav": "Main navigation",
  "app.loading": "Loading…",
  "tabs.review": "Review",
  "tabs.history": "History",

  "agents.lawyer.name": "Lawyer",
  "agents.lawyer.role": "Legal risk review",
  "agents.finance.name": "Finance",
  "agents.finance.role": "Financial terms analysis",
  "agents.security.name": "Security",
  "agents.security.role": "Information security",
  "agents.pm.name": "Project lead",
  "agents.pm.role": "Project goals alignment",

  "status.pending": "Pending",
  "status.processing": "Reviewing…",
  "status.approved": "Approved",
  "status.rejected": "Rejected",
  "status.revision": "Needs revision",
  "status.error": "Error",
  "status.refusal": "Model refusal",

  "verdict.approved": "Document approved",
  "verdict.rejected": "Document rejected",
  "verdict.revision": "Revision required",
  "verdict.approvedDesc": "All reviewers approved the document",
  "verdict.rejectedDesc": "Critical issues were found",
  "verdict.revisionDesc": "The document needs changes before approval",
  "verdict.approvedCount": "Approved: {approved} of {total}",

  "demo.banner":
    "Running in demo mode with sample responses. Add ANTHROPIC_API_KEY (Claude) or YC_API_KEY + YC_FOLDER_ID (YandexGPT).",
  "demo.bannerHint": "See README for API keys setup.",

  "review.document": "Document",
  "review.loadSample": "Load sample",
  "review.file": "File",
  "review.uploadFile": "Upload file",
  "review.dropHint": "Drop a .txt or .docx file here, or paste text below",
  "review.placeholder": "Paste contract or specification text…",
  "review.removeFile": "Remove file",
  "review.fileTooLarge": "File size must not exceed 5 MB",
  "review.readFailed": "Failed to read file",
  "review.minChars": "Min. {min} characters",
  "review.charCount": "{count} chars",
  "review.ready": "Ready to review",
  "review.reset": "Reset",
  "review.start": "Start review",
  "review.running": "Reviewing…",
  "review.preparing": "Preparing…",
  "review.checking": "Reviewing: {name} ({current}/{total})",
  "review.step": "Step {current} of {total}",
  "review.eta": "~{time} remaining",
  "review.results": "Results",
  "review.toastComplete": "Review complete",
  "review.emptyTitle": "Results appear after review",
  "review.emptyDesc": "Paste a document and click “Start review”",
  "review.retry": "Retry",
  "review.retryAgent": "Retry analysis: {name}",
  "review.issues": "Issues",
  "review.noComment": "No comment",
  "review.progressAria": "Approval progress",

  "history.loading": "Loading history…",
  "history.emptyHint": "No saved reviews yet",
  "history.count": "{filtered} of {total} records",
  "history.clear": "Clear all",
  "history.filterAll": "All",
  "history.filterApproved": "Approved",
  "history.filterRevision": "Revision",
  "history.filterRejected": "Rejected",
  "history.emptyTitle": "History is empty",
  "history.emptyDesc": "Completed reviews will show up here",
  "history.date": "Date",
  "history.document": "Document",
  "history.verdict": "Verdict",
  "history.delete": "Delete record",
  "history.filtersAria": "Filter by verdict",

  "actions.showCorrected": "Show corrected document",
  "actions.downloadMd": "Download .md",
  "actions.downloadPdf": "Download PDF",

  "modal.title": "Corrected document",
  "modal.subtitle": "Version incorporating expert feedback",
  "modal.reload": "Reload",
  "modal.reloadAria": "Reload corrections",
  "modal.generating": "Generating…",
  "modal.generateError": "Generation failed",
  "modal.revised": "Revised",
  "modal.diff": "Diff",
  "modal.copy": "Copy",
  "modal.apply": "Apply to document",
  "modal.close": "Close",
  "modal.copied": "Text copied",
  "modal.applied": "Document updated",
  "modal.noChanges": "No changes detected.",

  "error.retry": "Retry",
  "error.title": "Something went wrong",
  "error.unexpected": "An unexpected error occurred",
  "error.tryAgain": "Try again",
  "notFound.title": "Page not found",
  "notFound.home": "Back home",
};

const ru: Dict = {
  "meta.title": "AgentFlow — Согласование документов",
  "meta.description":
    "Система согласования документов. Юрист, финансист, СБ и руководитель проекта последовательно проверяют ваш документ.",
  "app.tagline": "Согласование документов",
  "app.nav": "Навигация",
  "app.loading": "Загрузка…",
  "tabs.review": "Проверка",
  "tabs.history": "История",

  "agents.lawyer.name": "Юрист",
  "agents.lawyer.role": "Проверка юридических рисков",
  "agents.finance.name": "Финансист",
  "agents.finance.role": "Анализ финансовых условий",
  "agents.security.name": "СБ",
  "agents.security.role": "Информационная безопасность",
  "agents.pm.name": "Руководитель проекта",
  "agents.pm.role": "Соответствие целям проекта",

  "status.pending": "Ожидание",
  "status.processing": "Проверка…",
  "status.approved": "Согласовано",
  "status.rejected": "Отклонено",
  "status.revision": "Доработка",
  "status.error": "Ошибка",
  "status.refusal": "Отказ модели",

  "verdict.approved": "Документ согласован",
  "verdict.rejected": "Документ отклонён",
  "verdict.revision": "Требуется доработка",
  "verdict.approvedDesc": "Все участники одобрили документ",
  "verdict.rejectedDesc": "Есть критические замечания",
  "verdict.revisionDesc": "Документ нужно доработать перед согласованием",
  "verdict.approvedCount": "Согласовано: {approved} из {total}",

  "demo.banner":
    "Демо-режим с готовыми ответами. Добавьте ANTHROPIC_API_KEY (Claude) или YC_API_KEY и YC_FOLDER_ID (YandexGPT).",
  "demo.bannerHint": "Подробности по ключам — в README.",

  "review.document": "Документ",
  "review.loadSample": "Загрузить пример",
  "review.file": "Файл",
  "review.uploadFile": "Загрузить файл",
  "review.dropHint": "Перетащите файл .txt или .docx сюда или вставьте текст ниже",
  "review.placeholder": "Вставьте текст договора или технического задания…",
  "review.removeFile": "Удалить файл",
  "review.fileTooLarge": "Размер файла не должен превышать 5 МБ",
  "review.readFailed": "Не удалось прочитать файл",
  "review.minChars": "Мин. {min} символов",
  "review.charCount": "{count} симв.",
  "review.ready": "Готов к проверке",
  "review.reset": "Сбросить",
  "review.start": "Запустить проверку",
  "review.running": "Проверка…",
  "review.preparing": "Подготовка…",
  "review.checking": "Проверяет: {name} ({current}/{total})",
  "review.step": "Этап {current} из {total}",
  "review.eta": "Осталось ~{time}",
  "review.results": "Результаты",
  "review.toastComplete": "Проверка завершена",
  "review.emptyTitle": "Результаты появятся после проверки",
  "review.emptyDesc": "Вставьте документ и нажмите «Запустить проверку»",
  "review.retry": "Повторить",
  "review.retryAgent": "Повторить анализ: {name}",
  "review.issues": "Замечания",
  "review.noComment": "Комментарий отсутствует",
  "review.progressAria": "Прогресс согласования",

  "history.loading": "Загрузка истории…",
  "history.emptyHint": "Пока нет сохранённых проверок",
  "history.count": "{filtered} из {total} записей",
  "history.clear": "Очистить",
  "history.filterAll": "Все",
  "history.filterApproved": "Согласовано",
  "history.filterRevision": "Доработка",
  "history.filterRejected": "Отклонено",
  "history.emptyTitle": "История пуста",
  "history.emptyDesc": "Здесь появятся результаты проверок",
  "history.date": "Дата",
  "history.document": "Документ",
  "history.verdict": "Вердикт",
  "history.delete": "Удалить запись",
  "history.filtersAria": "Фильтр по вердикту",

  "actions.showCorrected": "Показать исправленный договор",
  "actions.downloadMd": "Скачать .md",
  "actions.downloadPdf": "Скачать PDF",

  "modal.title": "Исправленный документ",
  "modal.subtitle": "Версия с учётом замечаний экспертов",
  "modal.reload": "Перезагрузить",
  "modal.reloadAria": "Перезагрузить исправления",
  "modal.generating": "Генерация…",
  "modal.generateError": "Ошибка генерации",
  "modal.revised": "Исправленный",
  "modal.diff": "Сравнение",
  "modal.copy": "Скопировать",
  "modal.apply": "Подставить в документ",
  "modal.close": "Закрыть",
  "modal.copied": "Текст скопирован",
  "modal.applied": "Документ обновлён",
  "modal.noChanges": "Изменений не обнаружено.",

  "error.retry": "Повторить",
  "error.title": "Что-то пошло не так",
  "error.unexpected": "Произошла непредвиденная ошибка",
  "error.tryAgain": "Попробовать снова",
  "notFound.title": "Страница не найдена",
  "notFound.home": "На главную",
};

export const dictionaries: Record<Locale, Dict> = { en, ru };

export type TranslationKey = keyof typeof en;

export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    template
  );
}

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ru";
}
