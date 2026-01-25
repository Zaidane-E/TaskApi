# Task API

Web app built with **C# (.NET 8)** backend and **Angular** frontend.  
Currently supports user tasks, task priorities, due dates, and completion tracking. Includes EF Core migrations, Swagger API, and unit tests.

---

![main-page](img/page.png)

## Features

- **Task Management**
  - Description, priority (Low, Medium, High), due date
  - Completion status and timestamps
  - Task filtering
- **Habit Tracking**
  - Add daily habits
  - Track completion rate and streaks
- **Accountability System**
  - Set daily goal percentage
  - Custom penalties and rewards
  - Daily logs with goal tracking
- **User Authentication** with JWT
- **Health Check** endpoint at `/health`

## To be added

- Graph user stats
- Journal
- Improved test coverage
- Improved accountability system with custom conditions
- Streak system integrated with accountabity features

## Known Issues
- Dashboard
	- Shows percentage for the wrong day in weekly view
	- Shows tasks as a fraction instead of just showing the number of tasks completed in that day

---

## Technologies

- **Backend:** C#, ASP.NET Core 8, Entity Framework Core 8, PostgreSQL (Neon)
- **Frontend:** Angular, TypeScript
- **Testing:** xUnit
- **Other:** Swagger/OpenAPI, Git

![swagger-page](img/swagger.png)

---

## Setup Instructions

### Backend

1. Navigate to backend folder:

```bash
cd backend/TaskAPI
```
2. Restore packages:

```bash
dotnet restore
```

3. Apply migrations and create database:

```bash
dotnet ef database update
```
    
4. Run the API:

```bash
dotnet run
```

Swagger UI available at https://localhost:<port>/swagger

### Frontend

1. Navigate to frontend folder:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run Angular dev server:

```bash
ng serve
```

App available at http://localhost:4200

### Running Tests

```bash
cd backend/TaskAPI.Tests
dotnet test
```
