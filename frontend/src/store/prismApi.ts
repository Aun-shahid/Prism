import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  ApplicationCreatePayload,
  ApplicationStats,
  ApplicationStatus,
  ApplicationUpdatePayload,
  JobApplication,
} from '../services/applications';
import type {
  Certification,
  Education,
  Project,
  ProfileUpdatePayload,
  UserProfile,
  WorkExperience,
} from '../services/profile';
import type { EmailSettings } from '../services/emailSettings';
import type { APIKey, APIKeyCreatePayload } from '../services/apiKeys';
import type { Notification } from '../services/notifications';
import type {
  GeneralScraperSource,
  GeneralScraperSourceCreatePayload,
  GeneralScraperSourceUpdatePayload,
  PaginatedScrapedJobs,
  ScrapedJob,
  ScraperTarget,
  ScraperTargetCreatePayload,
  ScraperTargetUpdatePayload,
  WatchCompanyPayload,
} from '../services/scraper';
import type {
  ResumeVersion,
  ResumeVersionCreatePayload,
  ResumeVersionUpdatePayload,
} from '../services/resumeBuilder';
import type { GeneratedDocument } from '../services/resume';
import type { InboundReply } from '../services/outreach';
import type { User, UserUpdatePayload } from '../services/users';

/** Default page size for the notifications bell; keep in sync with optimistic updates. */
export const NOTIFICATIONS_LIMIT = 15;

export interface ApplicationsQueryArgs {
  status?: ApplicationStatus;
  search?: string;
}

export interface ScrapedJobsQueryArgs {
  targetId?: string;
  page?: number;
  limit?: number;
}

export interface JobsFeedQueryArgs {
  page?: number;
  limit?: number;
  search?: string;
  isNew?: boolean;
}

export const prismApi = createApi({
  reducerPath: 'prismApi',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Applications',
    'ApplicationStats',
    'Profile',
    'EmailSettings',
    'ResumeVersions',
    'ResumeHistory',
    'ScraperTargets',
    'ScrapedJobs',
    'GeneralSources',
    'ApiKeys',
    'Notifications',
    'Users',
    'AdminStats',
    'InboundReplies',
  ],
  endpoints: (builder) => ({
    // ── Applications ─────────────────────────────────────────────
    getApplications: builder.query<JobApplication[], ApplicationsQueryArgs | void>({
      query: (args) => ({
        url: '/applications',
        params: {
          ...(args?.status ? { status: args.status } : {}),
          ...(args?.search ? { search: args.search } : {}),
        },
      }),
      providesTags: ['Applications'],
    }),
    getApplicationStats: builder.query<ApplicationStats, void>({
      query: () => ({ url: '/applications/stats' }),
      providesTags: ['ApplicationStats'],
    }),
    createApplication: builder.mutation<JobApplication, ApplicationCreatePayload>({
      query: (payload) => ({ url: '/applications', method: 'POST', data: payload }),
      invalidatesTags: ['Applications', 'ApplicationStats'],
    }),
    updateApplication: builder.mutation<
      JobApplication,
      { id: string; payload: ApplicationUpdatePayload }
    >({
      query: ({ id, payload }) => ({
        url: `/applications/${id}`,
        method: 'PATCH',
        data: payload,
      }),
      // Optimistic patch so kanban drag-and-drop doesn't snap back while the
      // request is in flight; the tag invalidation below re-syncs on settle.
      async onQueryStarted({ id, payload }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          prismApi.util.updateQueryData('getApplications', undefined, (draft) => {
            const app = draft.find((a) => a.id === id);
            if (app) Object.assign(app, payload);
          })
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ['Applications', 'ApplicationStats'],
    }),
    deleteApplication: builder.mutation<void, string>({
      query: (id) => ({ url: `/applications/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Applications', 'ApplicationStats'],
    }),

    // ── Profile ──────────────────────────────────────────────────
    getProfile: builder.query<UserProfile, void>({
      query: () => ({ url: '/profile' }),
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation<UserProfile, ProfileUpdatePayload>({
      query: (payload) => ({ url: '/profile', method: 'PUT', data: payload }),
      invalidatesTags: ['Profile'],
    }),
    updateSkills: builder.mutation<UserProfile, string[]>({
      query: (skills) => ({ url: '/profile/skills', method: 'PATCH', data: skills }),
      invalidatesTags: ['Profile'],
    }),
    updateJobTitles: builder.mutation<UserProfile, string[]>({
      query: (titles) => ({
        url: '/profile/job-titles',
        method: 'PATCH',
        data: titles,
      }),
      invalidatesTags: ['Profile'],
    }),
    addEducation: builder.mutation<UserProfile, Education>({
      query: (edu) => ({ url: '/profile/education', method: 'POST', data: edu }),
      invalidatesTags: ['Profile'],
    }),
    removeEducation: builder.mutation<UserProfile, number>({
      query: (index) => ({ url: `/profile/education/${index}`, method: 'DELETE' }),
      invalidatesTags: ['Profile'],
    }),
    addWorkExperience: builder.mutation<UserProfile, WorkExperience>({
      query: (exp) => ({ url: '/profile/experience', method: 'POST', data: exp }),
      invalidatesTags: ['Profile'],
    }),
    removeWorkExperience: builder.mutation<UserProfile, number>({
      query: (index) => ({ url: `/profile/experience/${index}`, method: 'DELETE' }),
      invalidatesTags: ['Profile'],
    }),
    addProject: builder.mutation<UserProfile, Project>({
      query: (proj) => ({ url: '/profile/projects', method: 'POST', data: proj }),
      invalidatesTags: ['Profile'],
    }),
    removeProject: builder.mutation<UserProfile, number>({
      query: (index) => ({ url: `/profile/projects/${index}`, method: 'DELETE' }),
      invalidatesTags: ['Profile'],
    }),
    addCertification: builder.mutation<UserProfile, Certification>({
      query: (cert) => ({
        url: '/profile/certifications',
        method: 'POST',
        data: cert,
      }),
      invalidatesTags: ['Profile'],
    }),
    removeCertification: builder.mutation<UserProfile, number>({
      query: (index) => ({
        url: `/profile/certifications/${index}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Profile'],
    }),
    uploadCV: builder.mutation<UserProfile, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: '/profile/upload-cv',
          method: 'POST',
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        };
      },
      invalidatesTags: ['Profile'],
    }),

    // ── Email settings ───────────────────────────────────────────
    getEmailSettings: builder.query<EmailSettings, void>({
      query: () => ({ url: '/email-settings' }),
      providesTags: ['EmailSettings'],
    }),
    updateEmailSettings: builder.mutation<EmailSettings, Partial<EmailSettings>>({
      query: (payload) => ({ url: '/email-settings', method: 'PUT', data: payload }),
      invalidatesTags: ['EmailSettings'],
    }),

    // ── Resume versions & history ────────────────────────────────
    getResumeVersions: builder.query<ResumeVersion[], void>({
      query: () => ({ url: '/resume/versions' }),
      providesTags: ['ResumeVersions'],
    }),
    createResumeVersion: builder.mutation<ResumeVersion, ResumeVersionCreatePayload>({
      query: (payload) => ({ url: '/resume/versions', method: 'POST', data: payload }),
      invalidatesTags: ['ResumeVersions'],
    }),
    updateResumeVersion: builder.mutation<
      ResumeVersion,
      { id: string; payload: ResumeVersionUpdatePayload }
    >({
      query: ({ id, payload }) => ({
        url: `/resume/versions/${id}`,
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['ResumeVersions'],
    }),
    deleteResumeVersion: builder.mutation<void, string>({
      query: (id) => ({ url: `/resume/versions/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ResumeVersions'],
    }),
    duplicateResumeVersion: builder.mutation<ResumeVersion, string>({
      query: (id) => ({ url: `/resume/versions/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: ['ResumeVersions'],
    }),
    getResumeHistory: builder.query<GeneratedDocument[], void>({
      query: () => ({ url: '/resume/history' }),
      providesTags: ['ResumeHistory'],
    }),

    // ── Scraper (watchlist / jobs) ───────────────────────────────
    getScraperTargets: builder.query<ScraperTarget[], void>({
      query: () => ({ url: '/scraper/targets' }),
      providesTags: ['ScraperTargets'],
    }),
    addScraperTarget: builder.mutation<ScraperTarget, ScraperTargetCreatePayload>({
      query: (payload) => ({ url: '/scraper/targets', method: 'POST', data: payload }),
      invalidatesTags: ['ScraperTargets'],
    }),
    watchCompany: builder.mutation<ScraperTarget, WatchCompanyPayload>({
      query: (payload) => ({
        url: '/scraper/targets/watch',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['ScraperTargets'],
    }),
    researchTarget: builder.mutation<ScraperTarget, string>({
      query: (id) => ({ url: `/scraper/targets/${id}/research`, method: 'POST' }),
      invalidatesTags: ['ScraperTargets'],
    }),
    updateScraperTarget: builder.mutation<
      ScraperTarget,
      { id: string; payload: ScraperTargetUpdatePayload }
    >({
      query: ({ id, payload }) => ({
        url: `/scraper/targets/${id}`,
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['ScraperTargets'],
    }),
    deleteScraperTarget: builder.mutation<void, string>({
      query: (id) => ({ url: `/scraper/targets/${id}`, method: 'DELETE' }),
      invalidatesTags: ['ScraperTargets', 'ScrapedJobs'],
    }),
    triggerScrape: builder.mutation<ScrapedJob[], string>({
      query: (id) => ({ url: `/scraper/targets/${id}/scrape`, method: 'POST' }),
      invalidatesTags: ['ScraperTargets', 'ScrapedJobs'],
    }),
    // Jobs feed (/jobs — Browse Jobs page; shares the ScrapedJobs tag family)
    getJobsFeed: builder.query<PaginatedScrapedJobs, JobsFeedQueryArgs | void>({
      query: (args) => ({
        url: '/jobs',
        params: {
          page: args?.page ?? 1,
          limit: args?.limit ?? 25,
          ...(args?.search ? { search: args.search } : {}),
          ...(args?.isNew !== undefined ? { is_new: args.isNew } : {}),
        },
      }),
      providesTags: ['ScrapedJobs'],
    }),
    markJobFeedRead: builder.mutation<ScrapedJob, string>({
      query: (jobId) => ({ url: `/jobs/${jobId}/read`, method: 'PATCH' }),
      // Optimistic is_new flip across every cached page; no invalidation — a
      // full refetch per click would be wasteful and the patch already matches
      // the server result.
      async onQueryStarted(jobId, { dispatch, queryFulfilled, getState }) {
        const patches = prismApi.util
          .selectCachedArgsForQuery(getState(), 'getJobsFeed')
          .map((args) =>
            dispatch(
              prismApi.util.updateQueryData('getJobsFeed', args, (draft) => {
                const job = draft.jobs.find((j) => j.id === jobId);
                if (job) job.is_new = false;
              })
            )
          );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
    }),
    importJobFeedJob: builder.mutation<
      JobApplication,
      { jobId: string; payload: { status: string; notes?: string } }
    >({
      query: ({ jobId, payload }) => ({
        url: `/jobs/${jobId}/import`,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['Applications', 'ApplicationStats', 'ScrapedJobs'],
    }),
    deleteJobFeedJob: builder.mutation<void, string>({
      query: (jobId) => ({ url: `/jobs/${jobId}`, method: 'DELETE' }),
      // Optimistic removal from every cached page; the tag invalidation below
      // then re-syncs totals/page boundaries from the server.
      async onQueryStarted(jobId, { dispatch, queryFulfilled, getState }) {
        const patches = prismApi.util
          .selectCachedArgsForQuery(getState(), 'getJobsFeed')
          .map((args) =>
            dispatch(
              prismApi.util.updateQueryData('getJobsFeed', args, (draft) => {
                const index = draft.jobs.findIndex((j) => j.id === jobId);
                if (index !== -1) {
                  draft.jobs.splice(index, 1);
                  draft.total = Math.max(0, draft.total - 1);
                }
              })
            )
          );
        try {
          await queryFulfilled;
        } catch {
          patches.forEach((p) => p.undo());
        }
      },
      invalidatesTags: ['ScrapedJobs'],
    }),

    getScrapedJobs: builder.query<PaginatedScrapedJobs, ScrapedJobsQueryArgs | void>({
      query: (args) => ({
        url: '/scraper/jobs',
        params: {
          page: args?.page ?? 1,
          limit: args?.limit ?? 10,
          ...(args?.targetId ? { target_id: args.targetId } : {}),
        },
      }),
      providesTags: ['ScrapedJobs'],
    }),
    markJobRead: builder.mutation<ScrapedJob, string>({
      query: (jobId) => ({ url: `/scraper/jobs/${jobId}/read`, method: 'PATCH' }),
      invalidatesTags: ['ScrapedJobs'],
    }),
    getGeneralSources: builder.query<GeneralScraperSource[], void>({
      query: () => ({ url: '/scraper/general-sources' }),
      providesTags: ['GeneralSources'],
    }),
    addGeneralSource: builder.mutation<
      GeneralScraperSource,
      GeneralScraperSourceCreatePayload
    >({
      query: (payload) => ({
        url: '/scraper/general-sources',
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: ['GeneralSources'],
    }),
    updateGeneralSource: builder.mutation<
      GeneralScraperSource,
      { id: string; payload: GeneralScraperSourceUpdatePayload }
    >({
      query: ({ id, payload }) => ({
        url: `/scraper/general-sources/${id}`,
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['GeneralSources'],
    }),
    deleteGeneralSource: builder.mutation<void, string>({
      query: (id) => ({ url: `/scraper/general-sources/${id}`, method: 'DELETE' }),
      invalidatesTags: ['GeneralSources'],
    }),
    triggerGeneralScrape: builder.mutation<ScrapedJob[], string>({
      query: (id) => ({
        url: `/scraper/general-sources/${id}/scrape`,
        method: 'POST',
      }),
      invalidatesTags: ['GeneralSources', 'ScrapedJobs'],
    }),

    // ── Inbound HR replies ───────────────────────────────────────
    getInboundReplies: builder.query<InboundReply[], void>({
      query: () => ({ url: '/outreach/replies' }),
      providesTags: ['InboundReplies'],
    }),

    // ── API keys ─────────────────────────────────────────────────
    getApiKeys: builder.query<APIKey[], void>({
      query: () => ({ url: '/api-keys' }),
      providesTags: ['ApiKeys'],
    }),
    storeApiKey: builder.mutation<APIKey, APIKeyCreatePayload>({
      query: (payload) => ({ url: '/api-keys', method: 'POST', data: payload }),
      invalidatesTags: ['ApiKeys'],
    }),
    deleteApiKey: builder.mutation<void, string>({
      query: (keyId) => ({ url: `/api-keys/${keyId}`, method: 'DELETE' }),
      invalidatesTags: ['ApiKeys'],
    }),
    toggleApiKey: builder.mutation<APIKey, { keyId: string; isActive: boolean }>({
      query: ({ keyId, isActive }) => ({
        url: `/api-keys/${keyId}/toggle?is_active=${isActive}`,
        method: 'PATCH',
      }),
      invalidatesTags: ['ApiKeys'],
    }),

    // ── Notifications ────────────────────────────────────────────
    getNotifications: builder.query<Notification[], number>({
      query: (limit) => ({ url: '/notifications', params: { limit } }),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<Notification, string>({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          prismApi.util.updateQueryData(
            'getNotifications',
            NOTIFICATIONS_LIMIT,
            (draft) => {
              const notif = draft.find((n) => n.id === id);
              if (notif) notif.is_read = true;
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),
    markAllNotificationsRead: builder.mutation<{ message: string }, void>({
      query: () => ({ url: '/notifications/read-all', method: 'POST' }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          prismApi.util.updateQueryData(
            'getNotifications',
            NOTIFICATIONS_LIMIT,
            (draft) => {
              draft.forEach((n) => {
                n.is_read = true;
              });
            }
          )
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
    }),

    // ── Admin (users) ────────────────────────────────────────────
    getUsers: builder.query<User[], void>({
      query: () => ({ url: '/users' }),
      providesTags: ['Users'],
    }),
    updateUser: builder.mutation<User, { userId: string; payload: UserUpdatePayload }>({
      query: ({ userId, payload }) => ({
        url: `/users/${userId}`,
        method: 'PATCH',
        data: payload,
      }),
      invalidatesTags: ['Users'],
    }),
    deleteUser: builder.mutation<void, string>({
      query: (userId) => ({ url: `/users/${userId}`, method: 'DELETE' }),
      invalidatesTags: ['Users', 'AdminStats'],
    }),
    getAdminStats: builder.query<
      { total_users: number; total_targets: number; total_jobs: number; total_sources: number },
      void
    >({
      query: () => ({ url: '/users/admin/stats' }),
      providesTags: ['AdminStats'],
    }),
  }),
});

export const {
  useGetApplicationsQuery,
  useGetApplicationStatsQuery,
  useCreateApplicationMutation,
  useUpdateApplicationMutation,
  useDeleteApplicationMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUpdateSkillsMutation,
  useUpdateJobTitlesMutation,
  useAddEducationMutation,
  useRemoveEducationMutation,
  useAddWorkExperienceMutation,
  useRemoveWorkExperienceMutation,
  useAddProjectMutation,
  useRemoveProjectMutation,
  useAddCertificationMutation,
  useRemoveCertificationMutation,
  useUploadCVMutation,
  useGetEmailSettingsQuery,
  useUpdateEmailSettingsMutation,
  useGetResumeVersionsQuery,
  useCreateResumeVersionMutation,
  useUpdateResumeVersionMutation,
  useDeleteResumeVersionMutation,
  useDuplicateResumeVersionMutation,
  useGetResumeHistoryQuery,
  useGetJobsFeedQuery,
  useMarkJobFeedReadMutation,
  useImportJobFeedJobMutation,
  useDeleteJobFeedJobMutation,
  useGetScraperTargetsQuery,
  useAddScraperTargetMutation,
  useWatchCompanyMutation,
  useResearchTargetMutation,
  useUpdateScraperTargetMutation,
  useDeleteScraperTargetMutation,
  useTriggerScrapeMutation,
  useGetScrapedJobsQuery,
  useMarkJobReadMutation,
  useGetGeneralSourcesQuery,
  useAddGeneralSourceMutation,
  useUpdateGeneralSourceMutation,
  useDeleteGeneralSourceMutation,
  useTriggerGeneralScrapeMutation,
  useGetInboundRepliesQuery,
  useGetApiKeysQuery,
  useStoreApiKeyMutation,
  useDeleteApiKeyMutation,
  useToggleApiKeyMutation,
  useGetNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetAdminStatsQuery,
} = prismApi;
