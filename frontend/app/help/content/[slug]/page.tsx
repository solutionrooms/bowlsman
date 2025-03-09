'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownComponentProps {
  node?: any;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

// Custom type for code component props that includes inline property
interface CodeComponentProps extends MarkdownComponentProps {
  inline: boolean;
}

export default function HelpContentPage() {
  const params = useParams();
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchContent = async () => {
      setIsLoading(true);
      try {
        const slug = params?.slug as string;
        const response = await fetch(`/help/content/${slug}.md`);
        
        if (!response.ok) {
          throw new Error(`Failed to load content: ${response.status}`);
        }
        
        const text = await response.text();
        setContent(text);
        setError(null);
      } catch (err) {
        console.error('Error loading help content:', err);
        setError('Failed to load help content. Please try again later.');
        setContent('');
      } finally {
        setIsLoading(false);
      }
    };

    if (params?.slug) {
      fetchContent();
    }
  }, [params?.slug]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="prose max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ node, ...props }: MarkdownComponentProps) => <h1 className="text-2xl font-bold mb-4" {...props} />,
          h2: ({ node, ...props }: MarkdownComponentProps) => <h2 className="text-xl font-bold mt-6 mb-3" {...props} />,
          h3: ({ node, ...props }: MarkdownComponentProps) => <h3 className="text-lg font-bold mt-5 mb-2" {...props} />,
          p: ({ node, ...props }: MarkdownComponentProps) => <p className="my-3" {...props} />,
          ul: ({ node, ...props }: MarkdownComponentProps) => <ul className="list-disc pl-6 my-3" {...props} />,
          ol: ({ node, ...props }: MarkdownComponentProps) => <ol className="list-decimal pl-6 my-3" {...props} />,
          li: ({ node, ...props }: MarkdownComponentProps) => <li className="mb-1" {...props} />,
          a: ({ node, ...props }: MarkdownComponentProps) => <a className="text-blue-600 hover:underline" {...props} />,
          blockquote: ({ node, ...props }: MarkdownComponentProps) => (
            <blockquote className="border-l-4 border-gray-200 pl-4 italic my-4" {...props} />
          ),
          code: (props: MarkdownComponentProps) => {
            const { node, ...rest } = props;
            // Use a type assertion to access the inline property
            const isInline = (props as any).inline;
            
            return isInline ? (
              <code className="bg-gray-100 px-1 py-0.5 rounded text-sm" {...rest} />
            ) : (
              <code className="block bg-gray-100 p-3 rounded text-sm overflow-x-auto my-4" {...rest} />
            );
          },
          img: ({ node, ...props }: MarkdownComponentProps) => <img className="max-w-full h-auto my-4 rounded" {...props} />,
          table: ({ node, ...props }: MarkdownComponentProps) => (
            <div className="overflow-x-auto my-6">
              <table className="min-w-full divide-y divide-gray-200" {...props} />
            </div>
          ),
          th: ({ node, ...props }: MarkdownComponentProps) => (
            <th className="px-4 py-2 bg-gray-50 text-left text-sm font-medium text-gray-700" {...props} />
          ),
          td: ({ node, ...props }: MarkdownComponentProps) => <td className="px-4 py-2 text-sm" {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
} 