import { FilePlus2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Client, getClient } from '../services/kyc-workflow.service';
import { kycStatusLabel } from '../utils/kyc-status-labels';

export function ClientDetailsPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    if (id) {
      getClient(id).then(setClient);
    }
  }, [id]);

  if (!client) {
    return <p className="text-sm text-slate-500">Loading client details...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{client.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {client.industry || 'Industry not captured'} {client.country ? `| ${client.country}` : ''}
          </p>
        </div>
        <Link
          to={`/kyc/new?clientId=${client.id}`}
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <FilePlus2 className="h-4 w-4" />
          Create KYC Case
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registration</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{client.registrationNumber || 'Not captured'}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{client.status}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">KYC Cases</p>
          <p className="mt-2 text-sm font-medium text-slate-950">{client.kycCases?.length || 0}</p>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Contacts</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {client.contacts?.length ? (
            client.contacts.map((contact) => (
              <div key={contact.id} className="rounded-md border border-slate-200 p-4">
                <p className="font-medium text-slate-950">{contact.name}</p>
                <p className="text-sm text-slate-500">{contact.position || 'Position not captured'}</p>
                <p className="mt-2 text-sm text-slate-600">{contact.email || 'No email'}</p>
                <p className="text-sm text-slate-600">{contact.phone || 'No phone'}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No contacts captured.</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">KYC Cases</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {client.kycCases?.length ? (
            client.kycCases.map((kycCase) => (
              <Link key={kycCase.id} to={`/kyc/${kycCase.id}`} className="block px-5 py-4 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{kycCase.title}</p>
                    <p className="text-sm text-slate-500">{kycCase.service?.name || 'Service not selected'}</p>
                  </div>
                  <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    {kycStatusLabel(kycCase.status)}
                  </span>
                </div>
              </Link>
            ))
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No KYC cases created yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
