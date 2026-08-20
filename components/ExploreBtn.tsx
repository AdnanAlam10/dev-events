"use client";

import Image from "next/image";

const ExploreBtn = () => {
  return (
    <a
      href="#events"
      id="explore-btn"
      className="mt-7 mx-auto flex-center gap-2 text-center w-fit"
    >
      Explore Events
      <Image
        src="/icons/arrow-down.svg"
        alt=""
        width={24}
        height={24}
      />
    </a>
  );
};

export default ExploreBtn;
