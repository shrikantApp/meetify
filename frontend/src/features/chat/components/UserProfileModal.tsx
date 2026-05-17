/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Loader2,
  Mail,
  Phone,
  UserCircle2,
  X,
} from 'lucide-react';
import { InputField, ModalPortal } from '../../../components/ui';
import { api } from '../../../services/api';
import { workspaceApi } from '../../../services/workspaceApi';
import { useAppDispatch, useAppSelector } from '../../../redux/store';
import { setUserProfile } from '../../../redux/auth/authSlice';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: Props) {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((state) => state.auth.userProfile);
  const [form, setForm] = useState({
    name: '',
    fullName: '',
    email: '',
    title: '',
    designation: '',
    phoneNumber: '',
    dateOfBirth: '',
    avatarUrl: '',
  });
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setForm({
      name: profile?.name || '',
      fullName: profile?.fullName || profile?.name || '',
      email: profile?.email || '',
      title: profile?.title || '',
      designation: profile?.designation || '',
      phoneNumber: profile?.phoneNumber || '',
      dateOfBirth: profile?.dateOfBirth ? String(profile.dateOfBirth).slice(0, 10) : '',
      avatarUrl: profile?.avatarUrl || '',
    });
    setDateOfBirth(profile?.dateOfBirth ? new Date(String(profile.dateOfBirth).slice(0, 10)) : null);
    setError('');
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const initials = (form.fullName || form.name || profile?.name || 'U').charAt(0).toUpperCase();

  const updateField = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      const { url, publicUrl } = await workspaceApi.getPresignedUrl(file.name, file.type);
      await workspaceApi.uploadFileToMinio(url, file);
      updateField('avatarUrl', publicUrl);
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const dobString = dateOfBirth ? dateOfBirth.toISOString().slice(0, 10) : '';
      const updated = await api.auth.updateProfile({
        name: form.name.trim(),
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        title: form.title.trim() || null,
        designation: form.designation.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        dateOfBirth: dobString || null,
        avatarUrl: form.avatarUrl || null,
      } as any);
      dispatch(setUserProfile(updated));
      onClose();
    } catch (saveError: any) {
      setError(saveError?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalPortal>
      <AnimatePresence>
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 14 }}
            className="relative z-10 flex h-[min(92vh,920px)] w-full max-w-5xl flex-col overflow-hidden rounded-[26px] border border-[var(--border-medium)] bg-[var(--bg-card)] shadow-2xl glass-morphism"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div>
                <h2 className="text-xl font-black text-[var(--text-primary)]">Profile</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Manage your professional details and contact information.
                </p>
              </div>
              <button onClick={onClose} className="preferences-icon-button">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
              <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
                <aside className="space-y-5">
                  <section className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                    <div className="relative mx-auto w-fit">
                      {form.avatarUrl ? (
                        <img
                          src={form.avatarUrl}
                          alt={form.fullName || form.name}
                          className="h-56 w-56 rounded-3xl object-cover border border-[var(--border-subtle)]"
                        />
                      ) : (
                        <div className="flex h-56 w-56 items-center justify-center rounded-3xl premium-gradient text-6xl font-black text-white shadow-xl">
                          {initials}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-base)] text-[var(--text-primary)] shadow-xl border border-[var(--border-subtle)]"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleAvatarUpload(event.target.files?.[0])}
                      />
                    </div>

                    <div className="mt-5 space-y-2 text-center xl:text-left">
                      <h3 className="text-3xl font-black text-[var(--text-primary)]">
                        {form.fullName || form.name || 'User'}
                      </h3>
                      <p className="text-lg font-semibold text-[var(--text-secondary)]">
                        {form.designation || 'Add your designation'}
                      </p>
                      <p className="text-sm text-[var(--text-muted)]">
                        {form.title || 'Professional title not added yet'}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                    <SectionHeading
                      icon={<UserCircle2 className="w-4 h-4" />}
                      eyebrow="Summary"
                      title="Quick details"
                      description="A compact overview of the details people see most often."
                    />
                    <div className="mt-4 space-y-3">
                      <ProfileInfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={form.email || 'Not added'} />
                      <ProfileInfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={form.phoneNumber || 'Not added'} />
                      <ProfileInfoRow
                        icon={<CalendarDays className="w-4 h-4" />}
                        label="Date of birth"
                        value={form.dateOfBirth || 'Not added'}
                      />
                      <ProfileInfoRow
                        icon={<BriefcaseBusiness className="w-4 h-4" />}
                        label="Designation"
                        value={form.designation || 'Not added'}
                      />
                    </div>
                  </section>
                </aside>

                <div className="space-y-5">
                  <SectionCard
                    eyebrow="Identity"
                    title="Basic profile"
                    description="These details shape how your profile appears across chats, workspaces, and member lists."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField
                        label="Display Name"
                        value={form.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="Display name"
                      />
                      <InputField
                        label="Full Name"
                        value={form.fullName}
                        onChange={(e) => updateField('fullName', e.target.value)}
                        placeholder="Full legal / full name"
                      />
                      <InputField
                        as="reactSelect"
                        label="Title"
                        value={TITLE_OPTIONS.find((o) => o.value === form.title) ?? null}
                        onChange={(opt) => updateField('title', opt?.value ?? '')}
                        options={TITLE_OPTIONS}
                        placeholder="Select title"
                        isClearable
                      />
                      <InputField
                        as="datePicker"
                        label="Date of Birth"
                        value={dateOfBirth}
                        onChange={(date) => setDateOfBirth(date)}
                        placeholder="YYYY-MM-DD"
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    eyebrow="Contact"
                    title="Reachability"
                    description="Keep your direct contact details current so teammates and workspace owners can reach you."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField
                        label="Email"
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="name@example.com"
                      />
                      <InputField
                        label="Phone Number"
                        type="tel"
                        value={form.phoneNumber}
                        onChange={(e) => updateField('phoneNumber', e.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </SectionCard>

                  <SectionCard
                    eyebrow="Professional"
                    title="Work details"
                    description="Show your role and professional identity the way you want colleagues to understand it."
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <InputField
                        label="Designation"
                        value={form.designation}
                        onChange={(e) => updateField('designation', e.target.value)}
                        placeholder="Senior Software Engineer"
                      />
                      <InputField
                        label="Avatar URL"
                        value={form.avatarUrl}
                        onChange={(e) => updateField('avatarUrl', e.target.value)}
                        placeholder="https://..."
                        hint="You can paste an image URL or use the camera button to upload."
                      />
                    </div>
                  </SectionCard>

                  {error ? (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                      {error}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-soft)] px-6 py-4">
              <button onClick={onClose} className="preferences-secondary-button" disabled={isSaving || isUploading}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="preferences-primary-button min-w-[140px] justify-center"
                disabled={isSaving || isUploading}
              >
                {isSaving ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    </ModalPortal>
  );
}

function ProfileInfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-3">
      <div className="mt-0.5 text-[var(--text-secondary)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</p>
        <p className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">{value}</p>
      </div>
    </div>
  );
}

const TITLE_OPTIONS = [
  { value: 'Mr', label: 'Mr' },
  { value: 'Ms', label: 'Ms' },
  { value: 'Mrs', label: 'Mrs' },
  { value: 'Dr', label: 'Dr' },
  { value: 'Prof', label: 'Prof' },
  { value: 'Eng', label: 'Eng' },
] as const;

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5 md:p-6">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {icon ? <span className="text-[var(--accent-primary)]">{icon}</span> : null}
        <span>{eyebrow}</span>
      </div>
      <h3 className="mt-2 text-xl font-black text-[var(--text-primary)]">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
