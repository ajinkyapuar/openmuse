# BE
pnpm dev

# FE
pnpm dev:web

# Browser
pnpm dev:browser

# Computer
docker build -t openmuse-computer:local   apps/computer


__________

Live Mode

# BE
pnpm dev


# FE
EXPO_PUBLIC_API_URL=http://192.168.1.103:8787 pnpm dev:web


# Android
EXPO_PUBLIC_API_URL=http://192.168.1.103:8787 pnpm --dir apps/mobile android