import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AddClientPage } from '../pages/AddClientPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { AmlDashboardPage } from '../pages/AmlDashboardPage';
import { ClientDetailsPage } from '../pages/ClientDetailsPage';
import { ClientListPage } from '../pages/ClientListPage';
import { CreateKycCasePage } from '../pages/CreateKycCasePage';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { KycCaseDetailsPage } from '../pages/KycCaseDetailsPage';
import { KycFormEditorPage } from '../pages/KycFormEditorPage';
import { InternalReviewWorkspacePage } from '../pages/InternalReviewWorkspacePage';
import { KycWorkflowPage } from '../pages/KycWorkflowPage';
import { LoginPage } from '../pages/LoginPage';
import { ModulesPage } from '../pages/ModulesPage';
import { SubmitToAmlPage } from '../pages/SubmitToAmlPage';
import { TenantsPage } from '../pages/TenantsPage';
import { UploadLegalDocumentsPage } from '../pages/UploadLegalDocumentsPage';
import { UsersPage } from '../pages/UsersPage';
import { ProtectedRoute } from './ProtectedRoute';
import { HomeRedirect, RequireRoles } from './RequireRoles';
import { workflowRoles } from '../utils/access-control';

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
          { path: '/', element: <HomeRedirect /> },
          { path: '/access-denied', element: <AccessDeniedPage /> },
          { path: '/dashboard', element: <DashboardPage /> },
          {
            element: <RequireRoles roles={workflowRoles.clientIntake} />,
            children: [
              { path: '/clients', element: <ClientListPage /> },
              { path: '/clients/new', element: <AddClientPage /> },
              { path: '/clients/:id/edit', element: <AddClientPage /> },
              { path: '/clients/:id', element: <ClientDetailsPage /> }
            ]
          },
          {
            element: <RequireRoles roles={workflowRoles.admin} />,
            children: [
              { path: '/tenants', element: <TenantsPage /> },
              { path: '/modules', element: <ModulesPage /> }
            ]
          },
          {
            element: <RequireRoles roles={workflowRoles.userAdmin} />,
            children: [{ path: '/users', element: <UsersPage /> }]
          },
          {
            element: <RequireRoles roles={[...workflowRoles.kycPreparation, ...workflowRoles.amlDashboard]} />,
            children: [
              { path: '/kyc-workflow', element: <KycWorkflowPage /> },
              { path: '/kyc/:id', element: <KycCaseDetailsPage /> }
            ]
          },
          {
            element: <RequireRoles roles={workflowRoles.kycPreparation} />,
            children: [
              { path: '/kyc/new', element: <CreateKycCasePage /> },
              { path: '/kyc/:id/edit', element: <CreateKycCasePage /> },
              { path: '/kyc/:id/form', element: <KycFormEditorPage /> },
              { path: '/kyc/:id/documents', element: <UploadLegalDocumentsPage /> },
              { path: '/kyc/:id/submit', element: <SubmitToAmlPage /> }
            ]
          },
          {
            element: <RequireRoles roles={workflowRoles.amlDashboard} />,
            children: [
              { path: '/kyc/:id/internal-review', element: <InternalReviewWorkspacePage /> },
              { path: '/aml', element: <AmlDashboardPage /> }
            ]
          }
        ]
      }
    ]
  }
]);
