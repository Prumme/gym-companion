import { createBrowserRouter } from 'react-router-dom';

import { AppLayout } from '@/app/layouts/AppLayout';
import { ErrorPage } from '@/app/pages/ErrorPage';
import { HomePage } from '@/app/pages/HomePage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { LoginPage } from '@/features/auth/pages/LoginPage';
import { RegisterPage } from '@/features/auth/pages/RegisterPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';
import { ProtectedRoute } from '@/features/auth/components/ProtectedRoute';
import { ProfilePage } from '@/features/profile/pages/ProfilePage';
import { ExercisesPage } from '@/features/exercises/pages/ExercisesPage';
import { ExerciseDetailPage } from '@/features/exercises/pages/ExerciseDetailPage';
import { CreateExercisePage } from '@/features/exercises/pages/CreateExercisePage';
import { EditExercisePage } from '@/features/exercises/pages/EditExercisePage';
import { ProgramsPage } from '@/features/programs/pages/ProgramsPage';
import { CreateProgramPage } from '@/features/programs/pages/CreateProgramPage';
import { ProgramDetailPage } from '@/features/programs/pages/ProgramDetailPage';
import { EditProgramPage } from '@/features/programs/pages/EditProgramPage';
import { PlanningPage } from '@/features/programs/pages/PlanningPage';
import { ProgramScheduleEditPage } from '@/features/programs/pages/ProgramScheduleEditPage';
import { ActiveWorkoutPage } from '@/features/workouts/pages/ActiveWorkoutPage';
import { WorkoutSessionDetailPage } from '@/features/workouts/pages/WorkoutSessionDetailPage';
import { WorkoutsHistoryPage } from '@/features/workouts/pages/WorkoutsHistoryPage';
import { PersonalRecordsPage } from '@/features/personal-records/pages/PersonalRecordsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'planning', element: <PlanningPage /> },
          { path: 'workouts', element: <WorkoutsHistoryPage /> },
          { path: 'records', element: <PersonalRecordsPage /> },
          { path: 'workouts/active', element: <ActiveWorkoutPage /> },
          {
            path: 'workouts/:workoutSessionId',
            element: <WorkoutSessionDetailPage />,
          },
          { path: 'programs', element: <ProgramsPage /> },
          { path: 'programs/new', element: <CreateProgramPage /> },
          { path: 'programs/:programId/edit', element: <EditProgramPage /> },
          { path: 'programs/:programId/schedule', element: <ProgramScheduleEditPage /> },
          { path: 'programs/:programId', element: <ProgramDetailPage /> },
          { path: 'exercises', element: <ExercisesPage /> },
          { path: 'exercises/new', element: <CreateExercisePage /> },
          { path: 'exercises/:exerciseId/edit', element: <EditExercisePage /> },
          { path: 'exercises/:exerciseId', element: <ExerciseDetailPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
