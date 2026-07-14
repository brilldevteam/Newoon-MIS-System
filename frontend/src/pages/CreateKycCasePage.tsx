import { ClipboardCheck } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SearchableMultiSelect } from '../components/SearchableSelect';
import { Client, createKycCase, getKycCase, listClients, updateKycCase } from '../services/kyc-workflow.service';
import { newoonServiceOptions, serviceListText, serviceListValue } from '../utils/newoon-services';

function getRequestErrorMessage(error: any, fallback: string) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  if (message && typeof message === 'object') {
    return Object.values(message)
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
  }

  const responseError = error.response?.data?.error;
  return typeof responseError === 'string' ? responseError : fallback;
}

export function CreateKycCasePage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const isEditMode = Boolean(id);
  const [form, setForm] = useState({
    clientId: searchParams.get('clientId') || '',
    title: '',
    services: [] as string[]
  });

  useEffect(() => {
    Promise.all([listClients(), id ? getKycCase(id) : Promise.resolve(null)])
      .then(([items, kycCase]) => {
        setClients(items);
        if (kycCase) {
          setForm({
            clientId: kycCase.client.id,
            title: kycCase.title || '',
            services: serviceListValue(kycCase.service?.name)
          });
          return;
        }

        if (items[0]) {
          setForm((current) => ({ ...current, clientId: current.clientId || items[0].id }));
        }
      })
      .catch((requestError: any) => {
        setError(getRequestErrorMessage(requestError, 'Unable to load KYC case details.'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const serviceName = serviceListText(form.services);
    const payload = {
      clientId: form.clientId,
      title: form.title || undefined,
      serviceName
    };

    try {
      const kycCase = id ? await updateKycCase(id, payload) : await createKycCase({ ...payload, serviceName: serviceName || undefined });
      navigate(`/kyc/${kycCase.id}`);
    } catch (requestError: any) {
      setError(getRequestErrorMessage(requestError, `Unable to ${isEditMode ? 'update' : 'create'} KYC case.`));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading KYC case...</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{isEditMode ? 'Edit KYC Case' : 'Create KYC Case'}</h1>
        <p className="mt-1 text-sm text-slate-500">{isEditMode ? 'Update the case client, title, and requested service.' : 'Open a client intake workflow and select the requested service.'}</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Client
            <select
              required
              value={form.clientId}
              onChange={(event) => setForm({ ...form, clientId: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <SearchableMultiSelect
            label="Requested services"
            value={form.services}
            options={newoonServiceOptions}
            onChange={(services) => setForm({ ...form, services })}
            placeholder="Select requested services"
          />
          <label className="text-sm font-medium text-slate-700 md:col-span-2">
            Case title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      <button
        type="submit"
        disabled={saving || !form.clientId}
        className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        <ClipboardCheck className="h-4 w-4" />
        {saving ? 'Saving...' : isEditMode ? 'Update Case' : 'Create Case'}
      </button>
    </form>
  );
}
