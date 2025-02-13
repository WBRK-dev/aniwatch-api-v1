import { type RequestHandler } from "express";
import { scrapeLandingPage } from "../parsers/index.js";

// /anime/landing
const getLandingPageInfo: RequestHandler<
  unknown,
  Awaited<ReturnType<typeof scrapeLandingPage>>
> = async (req, res, next) => {
  try {
    const data = await scrapeLandingPage();
    res.status(200).json(data);
  } catch (err: any) {
    console.error(err);
    next(err);
  }
};

export default getLandingPageInfo;
