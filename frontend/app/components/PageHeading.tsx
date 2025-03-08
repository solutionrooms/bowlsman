import React, { useState } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface PageHeadingProps {
  title: string;
  infoText?: string;
  className?: string;
}

const PageHeading: React.FC<PageHeadingProps> = ({ 
  title, 
  infoText, 
  className = "text-2xl font-bold" 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex items-start gap-1 relative">
      <h1 className={className}>{title}</h1>
      {infoText && (
        <div className="relative mt-1.5">
          <InformationCircleIcon 
            className="h-5 w-5 text-blue-500 cursor-pointer hover:text-blue-700"
            onClick={() => setShowTooltip(!showTooltip)}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            aria-label={`Information about ${title}`}
          />
          {showTooltip && (
            <div className="absolute z-10 w-64 p-3 bg-white rounded-lg shadow-lg border border-gray-200 text-sm text-gray-700 left-0 top-6">
              {infoText}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PageHeading; 