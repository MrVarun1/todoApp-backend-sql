import { Router } from "express";
import { v4 as uuidV4 } from "uuid";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "./index.js";

const router = Router();
const jwtSecret = "varun";

const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers["authorization"]?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Access Denied" });

    const verified = jwt.verify(token, jwtSecret);
    req.user = verified;
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError" ? "Token expired" : "Invalid Token";
    res.status(401).json({ error: message });
  }
};

const errorCatch = (err, req, res, next) => {
  console.log(`Error at ${req.path}:`, err);
  res.status(500).json({ error: err.message });
};

router.get("/validateJWT", authenticateUser, async (req, res) => {
  res.json({ message: "Valid JWT" });
});

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const isExistQuery = `
        SELECT *
        FROM users
        WHERE email = ?
        `;

    const existingUser = await db.get(isExistQuery, [email]);

    if (existingUser)
      return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 8);

    const registerUserQuery = `
    INSERT INTO users (user_id, name, email, password, created_at)
    VALUES 
        (?,?,?,?, datetime('now'))`;

    await db.run(registerUserQuery, [uuidV4(), name, email, hashedPassword]);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);

    if (!user)
      return res.status(400).json({ error: "Invalid email or password" });

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid)
      return res.status(400).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { email: user.email, id: user.user_id, name: user.name },
      jwtSecret,
      {
        expiresIn: "1 day",
      }
    );

    res.json({ message: "Login successfully", token });
  } catch (err) {
    next(err);
  }
});

router.get("/tasks", authenticateUser, async (req, res, next) => {
  try {
    const getTasksQuery = `
    SELECT * 
    FROM tasks
    WHERE user_id =?`;

    const tasks = await db.all(getTasksQuery, [req.user.id]);

    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

router.post("/tasks", authenticateUser, async (req, res, next) => {
  try {
    const { title, description, status, due_date } = req.body;
    const createTaskQuery = `
    INSERT INTO tasks
    (task_id, title, description, status, due_date, user_id)
    VALUES 
      (?,?,?,?,?,?)
    `;

    await db.run(createTaskQuery, [
      uuidV4(),
      title,
      description,
      status || "Pending",
      due_date,
      req.user.id,
    ]);

    res.status(201).json({ message: "Task added successfully" });
  } catch (err) {
    next(err);
  }
});

router.get("/tasks/:id", authenticateUser, async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const taskDetailsQuery = `
    SELECT *
    FROM tasks
    WHERE task_id = ?
    AND user_id = ?
    `;

    const task = await db.get(taskDetailsQuery, [taskId, req.user.id]);

    if (!task) return res.status(404).json({ error: "Task not found" });

    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.put("/tasks/:id", authenticateUser, async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const { title, description, status, due_date } = req.body;

    const existingTask = await db.get(
      `SELECT * FROM tasks WHERE task_id = ? AND user_id = ?`,
      [taskId, req.user.id]
    );

    if (!existingTask) return res.status(404).json({ error: "Task not found" });

    const updatedTask = {
      title: title || existingTask.title,
      description: description || existingTask.description,
      status: status || existingTask.status,
      due_date: due_date || existingTask.due_date,
    };

    const updateTaskQuery = `
    UPDATE tasks 
    SET 
      title =?,
      description =?,
      status =?,
      due_date =?
      WHERE task_id =?
      AND user_id =?`;

    await db.run(updateTaskQuery, [
      updatedTask.title,
      updatedTask.description,
      updatedTask.status,
      updatedTask.due_date,
      taskId,
      req.user.id,
    ]);

    res.json({ message: "Task updated successfully" });
  } catch (err) {
    next(err);
  }
});

router.delete("/tasks/:id", authenticateUser, async (req, res, next) => {
  try {
    const taskId = req.params.id;
    const deleteQuery = `
      DELETE FROM tasks 
      WHERE task_id = ?
      AND user_id = ?
    `;

    const result = await db.run(deleteQuery, [taskId, req.user.id]);

    if (result.changes === 0)
      return res.status(404).json({ error: "Task not found" });

    res.json({ message: "Task delete successfully" });
  } catch (err) {
    next(err);
  }
});

router.use(errorCatch);

export default router;
