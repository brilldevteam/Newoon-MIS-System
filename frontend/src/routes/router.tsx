import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AddClientPage } from '../pages/AddClientPage';
import { AccessDeniedPage } from '../pages/AccessDeniedPage';
import { ClientDetailsPage } from '../pages/ClientDetailsPage';
import { ClientListPage } from '../pages/ClientListPage';
import { CreateKycCasePage } from '../pages/CreateKycCasePage';
import { CrrfListPage } from '../pages/CrrfListPage';
import { CrrfWorkspacePage } from '../pages/CrrfWorkspacePage';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { DashboardPage } from '../pages/DashboardPage';
import { AddEnquiryPage } from '../pages/AddEnquiryPage';
import { EnquiryDetailsPage } from '../pages/EnquiryDetailsPage';
import { EnquiryListPage } from '../pages/EnquiryListPage';
import { KycCaseDetailsPage } from '../pages/KycCaseDetailsPage';
import { KycFormEditorPage } from '../pages/KycFormEditorPage';
import { KycScreeningPage } from '../pages/KycScreeningPage';
import { InternalReviewWorkspacePage } from '../pages/InternalReviewWorkspacePage';
import { KycWorkflowPage } from '../pages/KycWorkflowPage';
import { LoginPage } from '../pages/LoginPage';
import { ModulesPage } from '../pages/ModulesPage';
import { ReviewTasksPage } from '../pages/ReviewTasksPage';
import { ScreeningListPage } from '../pages/ScreeningListPage';
import { SubmitToAmlPage } from '../pages/SubmitToAmlPage';
import { TenantsPage } from '../pages/TenantsPage';
import { UploadLegalDocumentsPage } from '../pages/UploadLegalDocumentsPage';
import { UsersPage } from '../pages/UsersPage';
import { AccessControlPage } from '../pages/AccessControlPage';
import { ProtectedRoute } from './ProtectedRoute';
import { HomeRedirect, RequireAccess, RequireRoles } from './RequireRoles';
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
            element: <RequireAccess area="enquiries" fallbackRoles={workflowRoles.enquiries} />,
            children: [{ path: '/enquiries', element: <EnquiryListPage /> }]
          },
          {
            element: <RequireAccess area="enquiries" fallbackRoles={workflowRoles.enquiryView} />,
            children: [{ path: '/enquiries/:id', element: <EnquiryDetailsPage /> }]
          },
          {
            element: <RequireAccess area="enquiries" write fallbackRoles={workflowRoles.clientIntake} />,
            children: [{ path: '/enquiries/new', element: <AddEnquiryPage /> }]
          },
          {
            element: <RequireAccess area="enquiries" write fallbackRoles={workflowRoles.enquiryEditing} />,
            children: [{ path: '/enquiries/:id/edit', element: <AddEnquiryPage /> }]
          },
          {
            element: <RequireAccess area="clients" fallbackRoles={workflowRoles.clientIntake} />,
            children: [
              { path: '/clients', element: <ClientListPage /> },
              { path: '/clients/:id', element: <ClientDetailsPage /> }
            ]
          },
          {
            element: <RequireAccess area="clients" write fallbackRoles={workflowRoles.clientIntake} />,
            children: [
              { path: '/clients/new', element: <AddClientPage /> },
              { path: '/clients/:id/edit', element: <AddClientPage /> }
            ]
          },
          {
            element: <RequireAccess area="administration" fallbackRoles={workflowRoles.admin} />,
            children: [
              { path: '/tenants', element: <TenantsPage /> },
              { path: '/modules', element: <ModulesPage /> }
            ]
          },
          {
            element: <RequireAccess area="administration" fallbackRoles={workflowRoles.userAdmin} />,
            children: [{ path: '/users', element: <UsersPage /> }]
          },
          {
            element: <RequireRoles roles={workflowRoles.admin} />,
            children: [{ path: '/access-control', element: <AccessControlPage /> }]
          },
          {
            element: <RequireAccess area="kyc" fallbackRoles={[...workflowRoles.caseCreation, ...workflowRoles.kycPreparation, ...workflowRoles.reviewTasks]} />,
            children: [
              { path: '/kyc-workflow', element: <KycWorkflowPage /> },
              { path: '/kyc/:id', element: <KycCaseDetailsPage /> }
            ]
          },
          {
            element: <RequireAccess area="kyc" write fallbackRoles={workflowRoles.caseCreation} />,
            children: [
              { path: '/kyc/new', element: <CreateKycCasePage /> },
              { path: '/kyc/:id/edit', element: <CreateKycCasePage /> }
            ]
          },
          {
            element: <RequireAccess area="kyc" write fallbackRoles={workflowRoles.kycFormBuilder} />,
            children: [
              { path: '/kyc/:id/form', element: <KycFormEditorPage /> },
              { path: '/kyc/:id/submit', element: <SubmitToAmlPage /> }
            ]
          },
          {
            element: <RequireAccess area="kyc" write fallbackRoles={workflowRoles.documentUpload} />,
            children: [{ path: '/kyc/:id/documents', element: <UploadLegalDocumentsPage /> }]
          },
          {
            element: <RequireAccess area="screening" fallbackRoles={workflowRoles.screening} />,
            children: [
              { path: '/screening', element: <ScreeningListPage /> },
              { path: '/kyc/:id/screening', element: <KycScreeningPage /> }
            ]
          },
          {
            element: <RequireAccess area="crrf" fallbackRoles={workflowRoles.crrf} />,
            children: [
              { path: '/crrf', element: <CrrfListPage /> },
              { path: '/kyc/:id/crrf', element: <CrrfWorkspacePage /> }
            ]
          },
          {
            element: <RequireAccess area="approvals" fallbackRoles={workflowRoles.reviewTasks} />,
            children: [
              { path: '/kyc/:id/internal-review', element: <InternalReviewWorkspacePage /> }
            ]
          },
          {
            element: <RequireAccess area="approvals" fallbackRoles={workflowRoles.reviewTasks} />,
            children: [
              { path: '/review-tasks', element: <ReviewTasksPage /> }
            ]
          }
        ]
      }
    ]
  }
]);
