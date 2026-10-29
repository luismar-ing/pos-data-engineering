import { Router } from "express";
import {pool} from '../db/pool.js';

export const catalogoRouter = Router();

catalogoRouter.get('/', async (req, res) => {
    const result = await pool.query(
        `select id, name, category, unit_price, active from products where active = true order by name`
    );
    res.json(result.rows)
})