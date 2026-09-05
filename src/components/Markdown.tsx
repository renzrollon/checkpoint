import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Artifact markdown (change-reading spec): tables and task lists through
 * remark-gfm, raw HTML left as escaped text because there is no rehype-raw,
 * links opening in a new tab. Wide content scrolls inside its own container
 * so the 375 px page never scrolls sideways.
 */

const components: Components = {
  a({ href, children }) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="md-scroll">
        <table>{children}</table>
      </div>
    );
  },
};

export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
