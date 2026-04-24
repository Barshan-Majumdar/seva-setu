const express = require('express');
const prisma = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/tasks
 * @desc    Assign a volunteer to a need
 * @access  Private (Coordinator)
 */
router.post('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const { need_id, assigned_volunteer_id, notes } = req.body;

  try {
    const taskId = await prisma.$transaction(async (tx) => {
      // 1. Create task
      const task = await tx.task.create({
        data: {
          needId: need_id,
          assignedVolunteerId: assigned_volunteer_id,
          notes,
          status: 'assigned',
          assignedAt: new Date(),
        },
      });

      // 2. Update need status safely
      await tx.need.update({
        where: { id: need_id },
        data: { status: 'assigned', updatedAt: new Date() },
        select: { id: true },
      });

      return task.id;
    });

    res.status(201).json({ taskId, message: 'Volunteer assigned successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/tasks/:id/checkin
 * @desc    Volunteer GPS check-in
 * @access  Private (Volunteer)
 */
router.patch('/:id/checkin', auth, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: req.params.id },
        data: {
          status: 'in_progress',
          checkedInAt: new Date(),
        },
      });

      await tx.need.update({
        where: { id: task.needId },
        data: {
          status: 'in_progress',
          updatedAt: new Date(),
        },
        select: { id: true },
      });
    });

    res.json({ message: 'Checked in successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   PATCH /api/tasks/:id/complete
 * @desc    Mark task as completed
 * @access  Private (Volunteer)
 */
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    await prisma.$transaction(async (tx) => {
      // 1. Update task
      await tx.task.update({
        where: { id: req.params.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });

      // 2. Update need
      await tx.need.update({
        where: { id: task.needId },
        data: {
          status: 'completed',
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      // 3. Update volunteer stats
      const volunteer = await tx.volunteer.findUnique({
        where: { userId: task.assignedVolunteerId },
        select: { tasksCompleted: true, completionRate: true },
      });

      if (volunteer) {
        const newCompleted = (volunteer.tasksCompleted || 0) + 1;
        const newRate = Math.min(1.0, (volunteer.completionRate || 0) + 0.05);

        await tx.volunteer.update({
          where: { userId: task.assignedVolunteerId },
          data: {
            tasksCompleted: newCompleted,
            completionRate: newRate,
          },
          select: { userId: true },
        });
      }
    });

    res.json({ message: 'Task completed! Impact updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks/my
 * @desc    Get assigned tasks for the logged-in volunteer
 */
router.get('/my', auth, async (req, res) => {
  try {
    const tasks = await prisma.$queryRaw`
      SELECT
        t.id as task_id,
        t.status as task_status,
        t.assigned_at,
        n.title,
        n.need_type,
        n.urgency_score,
        n.ward,
        n.district,
        ST_X(n.location::geometry) as lng,
        ST_Y(n.location::geometry) as lat
      FROM tasks t
      JOIN needs n ON t.need_id = n.id
      WHERE t.assigned_volunteer_id = ${req.user.id}::uuid
      ORDER BY t.assigned_at DESC
    `;

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for coordinator dashboard
 * @access  Private (Coordinator)
 */
router.get('/', auth, async (req, res) => {
  if (req.user.role !== 'coordinator') {
    return res.status(403).json({ message: 'Access denied' });
  }

  try {
    const tasks = await prisma.$queryRaw`
      SELECT
        t.id AS task_id,
        t.status AS task_status,
        t.assigned_at,
        t.checked_in_at,
        t.completed_at,
        t.need_id,
        n.title AS need_title,
        n.status AS need_status,
        u.id AS volunteer_id,
        u.name AS volunteer_name
      FROM tasks t
      JOIN needs n ON t.need_id = n.id
      JOIN users u ON t.assigned_volunteer_id = u.id
      ORDER BY t.assigned_at DESC
    `;

    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
