import React from "react";
import Image from "next/image";

export const LogoIcon = (props: React.ComponentProps<"div">) => (
  <div {...props} className={`relative overflow-hidden rounded-md ${props.className || ""}`} style={{ width: 32, height: 38 }}>
    <Image
      src="/shaasthi-mark.png"
      alt="Shaasthi Logo Icon"
      fill
      className="object-contain"
    />
  </div>
);

export const Logo = (props: React.ComponentProps<"div">) => (
  <div {...props} className={`flex items-center gap-2 ${props.className || ""}`}>
    <div className="relative overflow-hidden rounded-md" style={{ width: 32, height: 38 }}>
      <Image
        src="/shaasthi-mark.png"
        alt="Shaasthi Logo Icon"
        fill
        className="object-contain"
      />
    </div>
    <span className="font-bold text-xl tracking-tight text-[#416CAF]">Shaasthi</span>
  </div>
);
