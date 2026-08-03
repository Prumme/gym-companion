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
