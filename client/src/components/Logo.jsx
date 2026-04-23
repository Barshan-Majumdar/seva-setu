/**
 * SevaSetu Logo — Two hands reaching toward each other,
 * forming a bridge (setu). Gradient from sky to indigo.
 */
const Logo = ({ size = 32, className = '', opacity = 1 }) => {
  const id = `logo-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent-sky)" />
          <stop offset="100%" stopColor="var(--color-accent-indigo)" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background rounded square */}
      <rect width="64" height="64" rx="18" fill={`url(#${id})`} />

      {/* Reaching Hands - Simplified and Modernized */}
      <g fill="white" filter="url(#glow)">
        {/* Left hand path */}
        <path 
          d="M14 42 C14 42 16 34 22 34 C28 34 32 30 32 30" 
          stroke="white" 
          strokeWidth="4" 
          strokeLinecap="round" 
          opacity="0.9"
        />
        {/* Right hand path */}
        <path 
          d="M50 42 C50 42 48 34 42 34 C36 34 32 30 32 30" 
          stroke="white" 
          strokeWidth="4" 
          strokeLinecap="round" 
          opacity="0.9"
        />
        {/* Central Heart/Spark */}
        <path 
          d="M32 26 C32 26 34 22 32 20 C30 22 32 26 32 26 Z" 
          fill="white" 
        />
      </g>
      
      {/* Visual Accents */}
      <circle cx="32" cy="30" r="3" fill="white" className="animate-pulse" />
    </svg>
  );
};

export default Logo;
