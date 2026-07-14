import { Save, Sparkles } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveOtherValue, SearchableSelect } from '../components/SearchableSelect';
import { createClient, getClient, updateClient } from '../services/kyc-workflow.service';
import { applyCountryDialCode, countryDialOptions } from '../utils/country-phone';

const industryOptions = [
  '',
  'Accounting',
  'Consulting',
  'Construction',
  'Education',
  'Finance',
  'Healthcare',
  'Hospitality',
  'IT Services',
  'Manufacturing',
  'Professional services',
  'Real estate',
  'Retail',
  'Services',
  'Trading'
];

const positionOptions = [
  '',
  'CEO',
  'CFO',
  'COO',
  'Director',
  'General Manager',
  'Manager',
  'Owner',
  'Partner',
  'Primary Contact',
  'Secretary',
  'Shareholder',
  'Authorized Signatory'
];

const countryOptions = countryDialOptions.map((country) => country.name);

function splitOtherValue(value: string | null | undefined, options: string[]) {
  if (!value || options.includes(value)) {
    return { value: value || '', otherValue: '' };
  }

  return { value: 'Other', otherValue: value };
}

function getRequestErrorMessage(error: any, fallback: string) {
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;

  const responseError = error.response?.data?.error;
  if (typeof responseError === 'string') return responseError;

  if (message && typeof message === 'object') {
    return Object.values(message)
      .flat()
      .map((value) => (typeof value === 'string' ? value : JSON.stringify(value)))
      .join(' ');
  }

  return fallback;
}

function generateRegistrationNumber(clientName: string, country: string) {
  const countryPrefix = country ? country.slice(0, 2).toUpperCase() : 'CL';
  const namePrefix = clientName
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, 'X');
  const sequence = String(Math.floor(1000 + Math.random() * 9000));

  return `${countryPrefix}-${namePrefix}-${sequence}`;
}

export function AddClientPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    registrationNumber: '',
    industry: '',
    industryOther: '',
    country: '',
    countryOther: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    contactPosition: '',
    contactPositionOther: ''
  });

  useEffect(() => {
    if (!id) return;
    getClient(id)
      .then((client) => {
        const primaryContact = client.contacts?.find((contact) => contact.isPrimary) || client.contacts?.[0];
        const industry = splitOtherValue(client.industry, industryOptions);
        const country = splitOtherValue(client.country, countryOptions);
        const position = splitOtherValue(primaryContact?.position, positionOptions);
        setForm({
          name: client.name || '',
          registrationNumber: client.registrationNumber || '',
          industry: industry.value,
          industryOther: industry.otherValue,
          country: country.value,
          countryOther: country.otherValue,
          contactName: primaryContact?.name || '',
          contactEmail: primaryContact?.email || '',
          contactPhone: applyCountryDialCode(primaryContact?.phone || '', client.country || ''),
          contactPosition: position.value,
          contactPositionOther: position.otherValue
        });
      })
      .catch((requestError: any) => {
        setError(getRequestErrorMessage(requestError, 'Unable to load client details.'));
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      name: form.name,
      registrationNumber: form.registrationNumber || undefined,
      industry: resolveOtherValue(form.industry, form.industryOther) || undefined,
      country: resolveOtherValue(form.country, form.countryOther) || undefined,
      contacts: form.contactName
        ? [
            {
              name: form.contactName,
              email: form.contactEmail || undefined,
              phone: form.contactPhone || undefined,
              position: resolveOtherValue(form.contactPosition, form.contactPositionOther) || undefined
            }
          ]
        : []
    };

    try {
      const client = id ? await updateClient(id, payload) : await createClient(payload);
      navigate(`/clients/${client.id}`);
    } catch (requestError: any) {
      setError(getRequestErrorMessage(requestError, `Unable to ${isEditMode ? 'update' : 'create'} client.`));
    } finally {
      setSaving(false);
    }
  }

  function setCountry(country: string) {
    setForm((current) => ({
      ...current,
      country,
      ...(country === 'Other' ? {} : { countryOther: '' }),
      contactPhone: applyCountryDialCode(current.contactPhone, country)
    }));
  }

  function setPhone(phone: string) {
    setForm((current) => ({
      ...current,
      contactPhone: applyCountryDialCode(phone, current.country)
    }));
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading client details...</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">{isEditMode ? 'Edit Client' : 'Add Client'}</h1>
        <p className="mt-1 text-sm text-slate-500">{isEditMode ? 'Update the client profile and primary contact.' : 'Capture the first client inquiry before opening a KYC case.'}</p>
      </div>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Client Profile</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Client name
            <input
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Registration number
            <div className="mt-1 flex gap-2">
              <input
                value={form.registrationNumber}
                onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, registrationNumber: generateRegistrationNumber(form.name, form.country) })}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </button>
            </div>
          </label>
          <SearchableSelect
            label="Industry"
            value={form.industry}
            otherValue={form.industryOther}
            options={industryOptions}
            onChange={(value) => setForm({ ...form, industry: value, ...(value === 'Other' ? {} : { industryOther: '' }) })}
            onOtherChange={(value) => setForm({ ...form, industryOther: value })}
            placeholder="Select industry"
            allowOther
          />
          <SearchableSelect
            label="Country"
            value={form.country}
            otherValue={form.countryOther}
            options={countryOptions}
            onChange={setCountry}
            onOtherChange={(value) => setForm({ ...form, countryOther: value })}
            placeholder="Select country"
            allowOther
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-950">Primary Contact</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            Contact name
            <input
              value={form.contactName}
              onChange={(event) => setForm({ ...form, contactName: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              type="email"
              value={form.contactEmail}
              onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Phone
            <input
              value={form.contactPhone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <SearchableSelect
            label="Position"
            value={form.contactPosition}
            otherValue={form.contactPositionOther}
            options={positionOptions}
            onChange={(value) => setForm({ ...form, contactPosition: value, ...(value === 'Other' ? {} : { contactPositionOther: '' }) })}
            onOtherChange={(value) => setForm({ ...form, contactPositionOther: value })}
            placeholder="Select position"
            allowOther
          />
        </div>
      </section>

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {saving ? 'Saving...' : isEditMode ? 'Update Client' : 'Create Client'}
      </button>
    </form>
  );
}
