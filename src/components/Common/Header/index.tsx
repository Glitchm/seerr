interface HeaderProps {
  extraMargin?: number;
  subtext?: React.ReactNode;
  rightSide?: React.ReactNode;
  children: React.ReactNode;
}

const Header = ({
  extraMargin = 0,
  subtext,
  rightSide,
  children,
}: HeaderProps) => {
  return (
    <div className="mt-8 md:flex md:items-center md:justify-between">
      <div className={`min-w-0 flex-1 mx-${extraMargin}`}>
        <h2
          className="mb-4 truncate text-2xl font-bold leading-7 text-gray-100 sm:overflow-visible sm:text-4xl sm:leading-9 md:mb-0"
          data-testid="page-header"
        >
          <span className="text-overseerr">{children}</span>
        </h2>
        {subtext && <div className="mt-2 text-gray-400">{subtext}</div>}
      </div>
      {rightSide && <div className="mt-4 md:mt-0">{rightSide}</div>}
    </div>
  );
};

export default Header;
