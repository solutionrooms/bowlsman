import React, { useState } from 'react';
import { InformationCircleIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';

interface PageHeadingProps {
  title: string;
  infoText?: string;
  className?: string;
  helpHref?: string;
}

const PageHeading: React.FC<PageHeadingProps> = ({ 
  title, 
  infoText, 
  className = "text-2xl font-bold",
  helpHref
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="flex items-start gap-2 relative">
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
      {helpHref && (
        <Link 
          href={helpHref}
          className="mt-1 px-3 py-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-full flex items-center gap-1 font-medium transition-colors duration-200 border border-blue-200"
        >
          <QuestionMarkCircleIcon className="h-4 w-4" />
          <span>Help</span>
        </Link>
      )}
    </div>
  );
};

export default PageHeading; 