import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	transpilePackages: [
		"@openmesa/ui",
		"react-markdown",
		"remark-gfm",
		"remark-parse",
		"unified",
		"ldrs",
	],
};

export default nextConfig;
