import api from '../api';

export interface Education {
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string; // "Present" or date
  gpa?: string;
  description?: string;
}

export interface WorkExperience {
  company: string;
  title: string;
  location?: string;
  start_date: string;
  end_date?: string; // Empty/null = current
  description?: string;
  highlights: string[];
}

export interface Project {
  name: string;
  description?: string;
  technologies: string[];
  url?: string;
  start_date?: string;
  end_date?: string;
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
  url?: string;
}

export interface JobPreferences {
  onsite: string[];
  remote: string[];
  hybrid: string[];
  exclusions: string[];
}

export interface UserProfile {
  id: string;
  user_id: string;
  headline?: string;
  summary?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  skills: string[];
  job_titles: string[];
  education: Education[];
  work_experience: WorkExperience[];
  projects: Project[];
  certifications: Certification[];
  languages: string[];
  job_preferences: JobPreferences;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdatePayload {
  headline?: string;
  summary?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
  skills?: string[];
  job_titles?: string[];
  education?: Education[];
  work_experience?: WorkExperience[];
  projects?: Project[];
  certifications?: Certification[];
  languages?: string[];
  job_preferences?: JobPreferences;
}

export const profileService = {
  async getProfile(): Promise<UserProfile> {
    const response = await api.get<UserProfile>('/profile');
    return response.data;
  },

  async updateProfile(payload: ProfileUpdatePayload): Promise<UserProfile> {
    const response = await api.put<UserProfile>('/profile', payload);
    return response.data;
  },

  async updateSkills(skills: string[]): Promise<UserProfile> {
    const response = await api.patch<UserProfile>('/profile/skills', skills);
    return response.data;
  },

  async updateJobTitles(jobTitles: string[]): Promise<UserProfile> {
    const response = await api.patch<UserProfile>('/profile/job-titles', jobTitles);
    return response.data;
  },

  async addEducation(edu: Education): Promise<UserProfile> {
    const response = await api.post<UserProfile>('/profile/education', edu);
    return response.data;
  },

  async removeEducation(index: number): Promise<UserProfile> {
    const response = await api.delete<UserProfile>(`/profile/education/${index}`);
    return response.data;
  },

  async addWorkExperience(exp: WorkExperience): Promise<UserProfile> {
    const response = await api.post<UserProfile>('/profile/experience', exp);
    return response.data;
  },

  async removeWorkExperience(index: number): Promise<UserProfile> {
    const response = await api.delete<UserProfile>(`/profile/experience/${index}`);
    return response.data;
  },

  async addProject(proj: Project): Promise<UserProfile> {
    const response = await api.post<UserProfile>('/profile/projects', proj);
    return response.data;
  },

  async removeProject(index: number): Promise<UserProfile> {
    const response = await api.delete<UserProfile>(`/profile/projects/${index}`);
    return response.data;
  },

  async addCertification(cert: Certification): Promise<UserProfile> {
    const response = await api.post<UserProfile>('/profile/certifications', cert);
    return response.data;
  },

  async removeCertification(index: number): Promise<UserProfile> {
    const response = await api.delete<UserProfile>(`/profile/certifications/${index}`);
    return response.data;
  },

  async uploadCV(file: File): Promise<UserProfile> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post<UserProfile>('/profile/upload-cv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
