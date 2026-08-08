import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { imageUrl } from '../api/client'

export default function Markdown({ text }: { text: string }) {
  // Detect if this is an error message
  const isError = text.includes('⚠️') || text.includes('🔑') || text.includes('⏱️') || text.toLowerCase().includes('error')
  
  return (
    <div className={`markdown text-[13px] leading-relaxed ${isError ? 'text-amber-200' : 'text-zinc-200'}`}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ node, ...props }) => (
            <img 
              {...props} 
              src={props.src ? imageUrl(props.src) : props.src}
              alt={props.alt || 'Generated image'}
              className="my-2 max-w-full rounded-lg border border-zinc-700 shadow-lg"
              style={{ maxHeight: '200px', objectFit: 'cover' }}
            />
          ),
          strong: ({ node, ...props }) => (
            <strong className={isError ? 'text-amber-100 font-semibold' : 'text-zinc-100 font-semibold'} {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="text-zinc-400 text-xs" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="my-2 ml-4 list-disc space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-[13px]" {...props} />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
