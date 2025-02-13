import {
  SRC_BASE_URL,
  ACCEPT_HEADER,
  USER_AGENT_HEADER,
  ACCEPT_ENCODING_HEADER,
} from "../utils/index.js";
import axios, { AxiosError } from "axios";
import createHttpError, { type HttpError } from "http-errors";
import type { ScrapedLandingPage } from "../types/parsers/index.js";
import { load, type CheerioAPI, type SelectorType } from "cheerio";

// /anime/landing
async function scrapeLandingPage(): Promise<ScrapedLandingPage | HttpError> {
  const res: ScrapedLandingPage = {
    coverImage: "",
    topSearches: [],
  };

  try {
    const mainPage = await axios.get(SRC_BASE_URL as string, {
      headers: {
        "User-Agent": USER_AGENT_HEADER,
        "Accept-Encoding": ACCEPT_ENCODING_HEADER,
        Accept: ACCEPT_HEADER,
      },
    });

    const $: CheerioAPI = load(mainPage.data);

    res.coverImage = SRC_BASE_URL + $(".mwt-icon img").first().attr("src");

    $("#xsearch .xhashtag a.item").each((i, el) => {
      res.topSearches.push($(el).text().trim());
    });

    return res;
  } catch (err: any) {
    if (err instanceof AxiosError) {
      throw createHttpError(
        err?.response?.status || 500,
        err?.response?.statusText || "Something went wrong"
      );
    }
    throw createHttpError.InternalServerError(err?.message);
  }
}

export default scrapeLandingPage;
