import { Edit3, Eye, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Client, deleteClient, listClients } from '../services/kyc-workflow.service';

export function ClientListPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  function loadClients() {
    setLoading(true);
    setError('');
    listClients()
      .then(setClients)
      .catch((requestError: any) => {
        setError(requestError.response?.data?.message || 'Unable to load clients.');
      })
      .finally(() => setLoading(false));
  }

  async function removeClient(client: Client) {
    const confirmed = window.confirm(
      `Delete ${client.name}? This will permanently remove the client and related KYC case records.`
    );
    if (!confirmed) return;

    setDeletingId(client.id);
    setError('');
    try {
      await deleteClient(client.id);
      setClients((current) => current.filter((item) => item.id !== client.id));
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Unable to delete this client.');
    } finally {
      setDeletingId('');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Clients</h1>
          <p className="mt-1 text-sm text-slate-500">Receive inquiries and prepare client files for KYC intake.</p>
        </div>
        <Link
          to="/clients/new"
          className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Add Client
        </Link>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          Client intake register
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Primary Contact</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3">Cases</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    Loading clients...
                  </td>
                </tr>
              ) : clients.length ? (
                clients.map((client) => {
                  const primaryContact = client.contacts?.find((contact) => contact.isPrimary) || client.contacts?.[0];
                  return (
                    <tr key={client.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <Link className="font-medium text-brand-700 hover:text-brand-800" to={`/clients/${client.id}`}>
                          {client.name}
                        </Link>
                        <p className="text-xs text-slate-500">{client.industry || 'Industry not captured'}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{primaryContact?.name || 'Not assigned'}</td>
                      <td className="px-4 py-3 text-slate-600">{client.country || 'Not captured'}</td>
                      <td className="px-4 py-3 text-slate-600">{client.kycCases?.length || 0}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {client.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link
                            to={`/clients/${client.id}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                            aria-label={`View ${client.name}`}
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Link
                            to={`/clients/${client.id}/edit`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
                            aria-label={`Edit ${client.name}`}
                            title="Edit"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeClient(client)}
                            disabled={deletingId === client.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Delete ${client.name}`}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-slate-500" colSpan={6}>
                    No client inquiries have been recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
