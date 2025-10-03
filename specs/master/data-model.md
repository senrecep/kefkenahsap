# Data Model (Prisma Schema)

This file defines the database schema using Prisma.

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Project {
  id              String   @id @default(cuid())
  title           String
  story           String
  client          String
  location        String
  services        String[]
  tags            String[]
  metaTitle       String
  metaDescription String
  images          String[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```
