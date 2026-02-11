'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MessageSquare, FolderOpen, ArrowRight, Send } from 'lucide-react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  slug: string;
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetchProjects();
    }
  }, [status, router]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (slug: string) => {
    router.push(`/project/${slug}`);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <MessageSquare className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Chat Assistant</h1>
          <p className="text-gray-600">
            Select a project to start chatting with your AI construction assistant
          </p>
        </div>

        {/* Chat Preview (disabled) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center gap-2 text-gray-400 mb-4">
            <MessageSquare className="w-5 h-5" />
            <span className="text-sm font-medium">Chat Preview</span>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-gray-500 text-sm italic">
              "Ask me anything about your construction project - schedules, documents, specifications..."
            </p>
          </div>
          <div className="relative">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Select a project below to start chatting..."
              disabled
              className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-lg bg-gray-50 text-gray-400 resize-none"
              rows={2}
            />
            <button
              disabled
              className="absolute right-3 bottom-3 p-2 rounded-lg bg-gray-200 text-gray-400 cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Project Selection */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 text-gray-700 mb-4">
            <FolderOpen className="w-5 h-5" />
            <span className="font-medium">Select a Project</span>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">You don't have any projects yet.</p>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => handleProjectSelect(project.slug)}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left group"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 group-hover:text-blue-600">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500">/{project.slug}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Back to Dashboard */}
        <div className="text-center mt-8">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
