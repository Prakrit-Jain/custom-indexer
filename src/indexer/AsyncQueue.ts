// Implementation of a Promise-based async queue
export class AsyncQueue {
    queue: any[];
    resolvers: ((any) => void)[];
    size: number;

    constructor() {
        this.queue = [];
        this.resolvers = [];
        this.size = 0;
    }

    enqueue(message) {
        if (this.resolvers.length > 0) {
            const resolver = this.resolvers.shift();
            resolver(message);
        } else {
            this.queue.push(message);
            this.size++;
        }
    }
    dequeue() {
        return new Promise((resolve) => {
            if (this.queue.length > 0) {
                const message = this.queue.shift();
                this.size--;
                resolve(message);
            } else {
                this.resolvers.push(resolve);
            }
        });
    }
    peek() {
        return new Promise((resolve) => {
            if (this.queue.length > 0) {
                resolve(this.queue[0]);
            } else {
                const resolver = (message) => {
                    this.queue.unshift(message); // Put the message back at the beginning of the queue
                    resolve(message);
                };
                this.resolvers.push(resolver);
            }
        });
    }
}