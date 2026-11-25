export const studyModels = {
  qwen: { id: 'qwen/qwen3.5-9b', display_name: 'Qwen3.5-9B' },
  gemini: { id: 'google/gemini-3.1-flash-lite', display_name: 'Gemini 3.1 Flash Lite' },
};

export const studyModelIds = Object.values(studyModels).map(({ id }) => id);
