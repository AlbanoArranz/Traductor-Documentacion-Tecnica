import axios from 'axios'

const API_BASE_URL = 'http://127.0.0.1:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
})

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config.url)
    return response
  },
  (error) => {
    console.error('API Error:', error.config?.url, error.response?.status, error.message)
    return Promise.reject(error)
  }
)

export interface Project {
  id: string
  name: string
  status: string
  page_count: number
  created_at: string
}

export interface Page {
  page_number: number
  has_original: boolean
  has_translated: boolean
  text_region_count: number
}

export interface TextRegion {
  id: string
  page_number: number
  bbox: number[]
  bbox_normalized: number[]
  src_text: string
  tgt_text: string | null
  confidence: number
  locked: boolean
  needs_review: boolean
  compose_mode: string
  font_size: number | null
  render_order: number
}

export interface GlossaryEntry {
  id?: string
  src_term: string
  tgt_term: string
  locked: boolean
}

export interface Job {
  id: string
  status: string
  progress: number
  current_step: string | null
  error: string | null
}

export interface Settings {
  deepl_api_key: string | null
  default_dpi: number
  min_han_ratio: number
}

export const projectsApi = {
  list: () => api.get<Project[]>('/projects'),
  get: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (name: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<Project>(`/projects?name=${encodeURIComponent(name)}`, formData)
  },
  delete: (id: string) => api.delete(`/projects/${id}`),
}

export const pagesApi = {
  list: (projectId: string) => api.get<Page[]>(`/projects/${projectId}/pages`),
  renderOriginal: (projectId: string, pageNumber: number, dpi = 450) =>
    api.post(`/projects/${projectId}/pages/${pageNumber}/render-original?dpi=${dpi}`),
  runOcr: (projectId: string, pageNumber: number, dpi = 450) =>
    api.post(`/projects/${projectId}/pages/${pageNumber}/ocr?dpi=${dpi}`),
  getTextRegions: (projectId: string, pageNumber: number) =>
    api.get<TextRegion[]>(`/projects/${projectId}/pages/${pageNumber}/text-regions`),
  updateTextRegion: (projectId: string, regionId: string, data: Partial<TextRegion>) =>
    api.patch<TextRegion>(`/projects/${projectId}/pages/text-regions/${regionId}`, data),
  deleteTextRegion: (projectId: string, regionId: string) =>
    api.delete(`/projects/${projectId}/pages/text-regions/${regionId}`),
  renderTranslated: (projectId: string, pageNumber: number, dpi = 450) =>
    api.post(`/projects/${projectId}/pages/${pageNumber}/render-translated?dpi=${dpi}`),
  getImageUrl: (projectId: string, pageNumber: number, kind: 'original' | 'translated', dpi = 450) =>
    `${API_BASE_URL}/projects/${projectId}/pages/${pageNumber}/image?kind=${kind}&dpi=${dpi}`,
  getThumbnailUrl: (projectId: string, pageNumber: number, kind: 'original' | 'translated') =>
    `${API_BASE_URL}/projects/${projectId}/pages/${pageNumber}/thumbnail?kind=${kind}`,
}

export const glossaryApi = {
  get: (projectId: string) => api.get<{ entries: GlossaryEntry[] }>(`/projects/${projectId}/glossary`),
  update: (projectId: string, entries: GlossaryEntry[]) =>
    api.put(`/projects/${projectId}/glossary`, { entries }),
  apply: (projectId: string) => api.post(`/projects/${projectId}/glossary/apply`),
}

export const jobsApi = {
  startRenderAll: (projectId: string) =>
    api.post<Job>(`/projects/${projectId}/jobs/render-all/async`),
  getStatus: (projectId: string, jobId: string) =>
    api.get<Job>(`/projects/${projectId}/jobs/${jobId}`),
}

export const exportApi = {
  generate: (projectId: string, dpi = 450) =>
    api.post(`/projects/${projectId}/export/pdf?dpi=${dpi}`),
  getDownloadUrl: (projectId: string, dpi = 450) =>
    `${API_BASE_URL}/projects/${projectId}/export/pdf/file?dpi=${dpi}`,
  downloadPdf: (projectId: string, dpi = 450) =>
    api.get(`/projects/${projectId}/export/pdf/file?dpi=${dpi}`, { responseType: 'blob' }),
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  update: (data: Partial<Pick<Settings, 'default_dpi' | 'min_han_ratio'>> & { deepl_api_key?: string }) =>
    api.put('/settings', data),
}
