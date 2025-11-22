declare namespace JSX {
  interface IntrinsicElements {
    'w3m-button': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      size?: 'sm' | 'md' | 'lg';
      label?: string;
      loadingLabel?: string;
    };
  }
}