# Dinero 💸
> Do you know all about your Dinero?

Dinero is a personal financial platform that tracks household income, expenses, and credit card activity — and turns them into clear insights and spending trends.

## What is this?

Dinero is a full-stack web application I built to solve a real problem: getting a clear monthly financial picture for a joint household. All bank accounts, all credit cards, all the data.

It parses the monthly exports that you upload from your bank accounts and credit suppliers, normalizes the data, and presents it as an interactive dashboard — with transaction history, AI category breakdowns, credit card tracking, and spending trends over time.

## Features

- **Multi-bank parsing** — handles structural differences between different bank account Excel exports
- **Monthly bottom line** — a normalized financial summary that separates routine activity from special income and expenses, giving a clear picture of where the month actually stands
- **Transaction categorization** — AI-powered categorization via the Anthropic API, with manual override
- **Credit card breakdown** — per card, per company, with ownership tracking (per person or shared)
- **Spending trends** — charts showing patterns across months and categories
- **Drill-down analysis** — click any category to see the transactions behind it

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Backend | Node.js + Express |
| Database | SQLite |
| AI | Anthropic Claude API |
| Dev Tools | VS Code, Claude Code (AI coding agent) |
| Version Control | Git + GitHub |

## Running Locally

```bash
# Clone the repo
git clone https://github.com/sagikyiet/Dinero.git
cd Dinero

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Add your Anthropic API key
echo "ANTHROPIC_API_KEY=your_key_here" > backend/.env

# Start the backend
cd backend && node src/index.js

# Start the frontend (new terminal)
cd frontend && npm run dev
```

Then open `http://localhost:5173`

## Background

I built Dinero as a learning project at the intersection of real-world utility and modern development practices — including AI-assisted coding with Claude Code. The goal was to build something I'd actually use and benefit from — and in the process, get hands-on experience with full-stack architecture, REST APIs, database design, and working with real-world messy data.