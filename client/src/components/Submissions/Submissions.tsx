import React from 'react';

const Submissions: React.FC = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary-light dark:text-text-primary-dark">Submissions</h1>
      <div className="bg-card-light dark:bg-card-dark/30 rounded-2xl shadow-sm border border-white dark:border-border-dark/30 p-6">
        <p className="text-text-secondary-light dark:text-text-secondary-dark">
          Submissions management and grading will be implemented here.
        </p>
      </div>
    </div>
  );
};

export default Submissions;
