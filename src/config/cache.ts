import { type CacheItem } from "../types/cache.js";
import { CACHE_ENABLED, CACHE_LIFETIME } from "../utils/constants.js";
import { type NextFunction } from "express";

export class Cache {

    public enabled: Boolean = CACHE_ENABLED;
    private cacheLayer : CacheItem[] = [];

    public set = (key: string, body: any): void => {
        const foundCacheItem = this.cacheLayer.find(item => item.key === key);
        if (foundCacheItem) {
            const cacheItemIndex = this.cacheLayer.indexOf(foundCacheItem);
            this.cacheLayer[cacheItemIndex].body = body;
            this.cacheLayer[cacheItemIndex].date = new Date();
        } else {
            this.cacheLayer.push({
                key,
                body,
                date: new Date()
            });
        }
    }
    
    public get = (key: string): CacheItem | undefined => {
        return this.cacheLayer.find(item => 
            item.key === key && Number(item.date) > Number(new Date()) - CACHE_LIFETIME
        );
    }
    
    public check = (key: string): Boolean => {
        return Boolean(this.cacheLayer.filter(item => 
            item.key === key && Number(item.date) > Number(new Date()) - CACHE_LIFETIME
        ).length);
    }

}