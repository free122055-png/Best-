import React from 'react';
import AmbSalaryAdmin from '../AmbSalaryAdmin';

interface AdminSalarySectionProps {
  adminTab: string;
  setViewingGrid: (viewing: boolean) => void;
  setAdminTab: (tab: any) => void;
}

export default function AdminSalarySection({
  adminTab,
  setViewingGrid,
  setAdminTab
}: AdminSalarySectionProps) {
  if (adminTab !== 'salary_admin') return null;

  return (
    <div className="w-full text-left animate-fade-in" id="admin-salary-section">
      <AmbSalaryAdmin 
        onBack={() => {
          setViewingGrid(true);
          setAdminTab('general');
        }}
      />
    </div>
  );
}
