import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AddClientPage } from '../pages/AddClientPage';
import { AmlDashboardPage } from '../pages/AmlDashboardPage';
import { ClientDetailsPage } from '../pages/ClientDetailsPage';
import { ClientListPage } from '../pages/ClientListPage';
import { CreateKycCasePage } from '../pages/CreateKycCasePage';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { KycCaseDetailsPage } from '../pages/KycCaseDetailsPage';
import { KycFormEditorPage } from '../pages/KycFormEditorPage';
import { KycWorkflowPage } from '../pages/KycWorkflowPage';
import { LoginPage } from '../pages/LoginPage';
import { ModulesPage } from '../pages/ModulesPage';
import { SubmitToAmlPage } from '../pages/SubmitToAmlPage';
import { TenantsPage } from '../pages/TenantsPage';
import { UploadLegalDocumentsPage } from '../pages/UploadLegalDocumentsPage';
import { UsersPage } from '../pages/UsersPage';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          { path: '/dashboard', element: <DashboardPage /> },
          { path: '/clients', element: <ClientListPage /> },
          { path: '/clients/new', element: <AddClientPage /> },
          { path: '/clients/:id/edit', element: <AddClientPage /> },
          { path: '/clients/:id', element: <ClientDetailsPage /> },
          { path: '/tenants', element: <TenantsPage /> },
          { path: '/modules', element: <ModulesPage /> },
          { path: '/users', element: <UsersPage /> },
          { path: '/kyc-workflow', element: <KycWorkflowPage /> },
          { path: '/kyc/new', element: <CreateKycCasePage /> },
          { path: '/kyc/:id/edit', element: <CreateKycCasePage /> },
          { path: '/kyc/:id', element: <KycCaseDetailsPage /> },
          { path: '/kyc/:id/form', element: <KycFormEditorPage /> },
          { path: '/kyc/:id/documents', element: <UploadLegalDocumentsPage /> },
          { path: '/kyc/:id/submit', element: <SubmitToAmlPage /> },
          { path: '/aml', element: <AmlDashboardPage /> }
        ]
      }
    ]
  }
]);
