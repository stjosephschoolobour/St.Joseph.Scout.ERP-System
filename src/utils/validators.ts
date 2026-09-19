import { MemberFormData } from '../features/members';

export function calculateAge(birthDateStr: string): number {
  if (!birthDateStr) return 0;
  const birthDate = new Date(birthDateStr);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function validateNationalId(nationalId: string): { valid: boolean; error?: string } {
  if (!nationalId || !nationalId.trim()) {
    return { valid: false, error: 'الرقم القومي إجباري' };
  }
  const cleanId = nationalId.trim();
  if (!/^\d{14}$/.test(cleanId)) {
    return { valid: false, error: 'الرقم القومي يجب أن يتكون من 14 رقماً بالضبط' };
  }
  return { valid: true };
}

export function validateMemberForm(data: MemberFormData): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!data.student_name || !data.student_name.trim()) {
    errors.student_name = 'اسم الطالبة إجباري';
  }

  const nidCheck = validateNationalId(data.national_id);
  if (!nidCheck.valid) {
    errors.national_id = nidCheck.error || 'الرقم القومي غير صالح';
  }

  if (!data.birth_date || !data.birth_date.trim()) {
    errors.birth_date = 'تاريخ الميلاد إجباري';
  } else {
    const bDate = new Date(data.birth_date);
    if (isNaN(bDate.getTime())) {
      errors.birth_date = 'تاريخ الميلاد غير صالح';
    } else {
      const year = bDate.getFullYear();
      const currentYear = new Date().getFullYear();
      if (year < 1940 || year > currentYear) {
        errors.birth_date = 'تاريخ الميلاد غير منطقي';
      }
    }
  }

  if (!data.school_stage) {
    errors.school_stage = 'الصف الدراسي إجباري';
  }

  const joinYear = Number(data.scout_join_year);
  const currentYear = new Date().getFullYear();
  if (!joinYear || isNaN(joinYear) || joinYear < 1980 || joinYear > currentYear + 1) {
    errors.scout_join_year = `سنة الالتحاق غير صحيحة (بين 1980 و ${currentYear + 1})`;
  }

  if (!data.member_type || !['عضوة', 'قائد'].includes(data.member_type)) {
    errors.member_type = 'الصفة إجبارية (عضوة أو قائد)';
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (data.member_type === 'قائد') {
    if (!data.leader_phone || !data.leader_phone.trim()) {
      errors.leader_phone = 'رقم تليفون القائد إجباري';
    } else {
      const cleaned = data.leader_phone.trim();
      if (!/^01[0125][0-9]{8}$/.test(cleaned) && !/^[0-9]{7,15}$/.test(cleaned)) {
        errors.leader_phone = 'رقم تليفون القائد غير صالح (مثال: 01012345678)';
      }
    }

    if (data.leader_email && data.leader_email.trim()) {
      if (!emailRegex.test(data.leader_email.trim())) {
        errors.leader_email = 'البريد الإلكتروني للقائد غير صالح (مثال: leader@example.com)';
      }
    }
  } else {
    if (data.father_phone && data.father_phone.trim()) {
      const cleaned = data.father_phone.trim();
      if (!/^01[0125][0-9]{8}$/.test(cleaned) && !/^[0-9]{7,15}$/.test(cleaned)) {
        errors.father_phone = 'رقم تليفون الأب غير صالح (مثال: 01012345678)';
      }
    }

    if (data.mother_phone && data.mother_phone.trim()) {
      const cleaned = data.mother_phone.trim();
      if (!/^01[0125][0-9]{8}$/.test(cleaned) && !/^[0-9]{7,15}$/.test(cleaned)) {
        errors.mother_phone = 'رقم تليفون الأم غير صالح (مثال: 01012345678)';
      }
    }

    if (data.mother_email && data.mother_email.trim()) {
      if (!emailRegex.test(data.mother_email.trim())) {
        errors.mother_email = 'البريد الإلكتروني للأم غير صالح (مثال: mother@example.com)';
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
