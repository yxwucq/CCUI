import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/core';

// Register common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import bash from 'highlight.js/lib/languages/bash';
import yaml from 'highlight.js/lib/languages/yaml';
import sql from 'highlight.js/lib/languages/sql';
import markdown from 'highlight.js/lib/languages/markdown';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import java from 'highlight.js/lib/languages/java';
import diff from 'highlight.js/lib/languages/diff';
import 'highlight.js/styles/github-dark.min.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('jsx', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('tsx', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('shell', bash);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('yml', yaml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('md', markdown);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('rs', rust);
hljs.registerLanguage('java', java);
hljs.registerLanguage('diff', diff);

const EXT_TO_LANG: Record<string, string> = {
  js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', mts: 'typescript',
  py: 'python',
  json: 'json', jsonc: 'json',
  css: 'css', scss: 'css',
  html: 'html', htm: 'html', xml: 'xml', svg: 'xml',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  yaml: 'yaml', yml: 'yaml',
  sql: 'sql',
  md: 'markdown', mdx: 'markdown',
  go: 'go',
  rs: 'rust',
  java: 'java',
  diff: 'diff', patch: 'diff',
};

function getLang(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANG[ext] || null;
}

function isMarkdown(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return ext === 'md' || ext === 'mdx';
}

interface Props {
  content: string;
  filePath: string;
}

export default function CodeViewer({ content, filePath }: Props) {
  if (isMarkdown(filePath)) {
    return (
      <div className="p-4 prose prose-invert prose-sm max-w-none [&_pre]:bg-gray-900 [&_pre]:rounded [&_pre]:p-3 [&_code]:text-blue-300 [&_table]:border-collapse [&_th]:border [&_th]:border-gray-700 [&_th]:px-3 [&_th]:py-1.5 [&_td]:border [&_td]:border-gray-700 [&_td]:px-3 [&_td]:py-1.5 [&_img]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-gray-600 [&_blockquote]:pl-4 [&_blockquote]:text-gray-400">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              const lang = match?.[1];
              const code = String(children).replace(/\n$/, '');
              if (lang && hljs.getLanguage(lang)) {
                const highlighted = hljs.highlight(code, { language: lang });
                return (
                  <code
                    className={className}
                    dangerouslySetInnerHTML={{ __html: highlighted.value }}
                    {...props}
                  />
                );
              }
              return <code className={className} {...props}>{children}</code>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  const lang = getLang(filePath);
  const highlighted = useMemo(() => {
    if (!lang || !content) return null;
    try {
      return hljs.highlight(content, { language: lang });
    } catch {
      return null;
    }
  }, [content, lang]);

  const lines = (highlighted ? highlighted.value : content).split('\n');

  return (
    <div className="text-xs font-mono leading-relaxed">
      {lines.map((line, i) => (
        <div key={i} className="flex hover:bg-gray-800/30">
          <span className="w-12 shrink-0 text-right pr-3 text-gray-600 select-none border-r border-gray-800/50">
            {i + 1}
          </span>
          {highlighted ? (
            <span className="px-3 whitespace-pre" dangerouslySetInnerHTML={{ __html: line || ' ' }} />
          ) : (
            <span className="px-3 whitespace-pre text-gray-300">{line || ' '}</span>
          )}
        </div>
      ))}
    </div>
  );
}
