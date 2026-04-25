export const TAGS = {
  salary_sagi:    { label: 'משכורת שגיא',  color: '#059669', bg: '#ecfdf5', type: 'income' },
  salary_maya:    { label: 'משכורת מאיה',  color: '#0284c7', bg: '#f0f9ff', type: 'income' },
  savings:        { label: 'חיסכון',        color: '#7c3aed', bg: '#f5f3ff', type: 'expense' },
  large_income:   { label: 'הכנסה מיוחדת',  color: '#2563eb', bg: '#eff6ff', type: 'income' },
  large_expense:  { label: 'הוצאה מיוחדת',  color: '#dc2626', bg: '#fef2f2', type: 'expense' },
  routine_income:  { label: 'הכנסות שגרה',  color: '#d97706', bg: '#fffbeb', type: 'income' },
  routine_expense: { label: 'הוצאות שגרה',  color: '#6b7280', bg: '#f9fafb', type: 'expense' },
};

export function isSalaryTag(tag) {
  return tag === 'salary_sagi' || tag === 'salary_maya';
}
