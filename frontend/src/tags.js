export const TAGS = {
  salary_sagi:   { label: 'משכורת שגיא',  color: '#059669', bg: '#ecfdf5' },
  salary_maya:   { label: 'משכורת מאיה',  color: '#0284c7', bg: '#f0f9ff' },
  savings:       { label: 'חיסכון',        color: '#7c3aed', bg: '#f5f3ff' },
  large_income:  { label: 'הכנסה גדולה',   color: '#2563eb', bg: '#eff6ff' },
  large_expense: { label: 'הוצאה גדולה',   color: '#dc2626', bg: '#fef2f2' },
};

export function isSalaryTag(tag) {
  return tag === 'salary_sagi' || tag === 'salary_maya';
}
