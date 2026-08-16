/**
 * SUN MOBILITY mark, drawn inline so it stays crisp at any size and needs no
 * asset pipeline. If the official SVG/PNG is supplied, drop it into
 * `public/` and swap the <svg> below for an <Image>.
 *
 * The mark is a solar-panel disc — sunlit cells at the top, dark cells below —
 * wrapped by a leaf that curves around it.
 */
export function SunMobilityLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="SUN MOBILITY"
      className="flex-none"
    >
      <defs>
        <linearGradient id="sm-sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBE36B" />
          <stop offset="55%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#F0932B" />
        </linearGradient>
        <linearGradient id="sm-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22376B" />
          <stop offset="100%" stopColor="#4A6094" />
        </linearGradient>
        <linearGradient id="sm-leaf" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4CAF50" />
          <stop offset="100%" stopColor="#8DC63F" />
        </linearGradient>
        <clipPath id="sm-disc">
          <circle cx="30" cy="33" r="21" />
        </clipPath>
      </defs>

      {/* Solar disc: sunlit upper half, panel lower half */}
      <g clipPath="url(#sm-disc)">
        <rect x="9" y="12" width="42" height="21" fill="url(#sm-sun)" />
        <rect x="9" y="33" width="42" height="21" fill="url(#sm-panel)" />
        {/* Cell grid */}
        <g stroke="#FFFFFF" strokeWidth="1.4" opacity="0.85">
          {[16, 23, 30, 37, 44].map((x) => (
            <line key={`v${x}`} x1={x} y1="10" x2={x} y2="56" />
          ))}
          {[19, 26, 33, 40, 47].map((y) => (
            <line key={`h${y}`} x1="7" y1={y} x2="53" y2={y} />
          ))}
        </g>
      </g>

      {/* Leaf sweeping around the disc */}
      <path
        d="M30 5C15 5 3 17 3 32c0 12 8 22 19 25-9-5-15-14-15-25 0-15 12-27 27-27 2 0 4 .2 6 .6C37 5.2 33.5 5 30 5z"
        fill="url(#sm-leaf)"
      />
      <path
        d="M31 4C20 4 10 11 6 21c6-8 15-13 25-13 4 0 8 .8 11 2.3C38 6.4 34.7 4 31 4z"
        fill="url(#sm-leaf)"
      />
      <path
        d="M8 30C8 16 19 6 32 6c-11 4-19 13-19 24 0 6 2 11 6 15-7-4-11-9-11-15z"
        fill="#3FA23F"
        opacity="0.55"
      />
    </svg>
  );
}

/** Wordmark used beside the icon in the sidebar. */
export function SunMobilityWordmark() {
  return (
    <span className="text-[15px] font-extrabold leading-[1.05] tracking-tight text-[#22376B]">
      SUN
      <br />
      MOBILITY
    </span>
  );
}
