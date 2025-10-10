import Joi, { number } from "joi";
import { Request, Response, NextFunction } from "express";

const validate = (schema: Joi.ObjectSchema<object>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    const valid = error == null;

    if (valid) {
      next();
    } else {
      const { details } = error;
      const message = details.map((i) => i.message).join(",");

      const newMessage = message.replace(/"/g, "");
      res.status(422).json({
        status: "error",
        message: newMessage,
      });
    }
  };
};

const schemas = {

};

export { validate, schemas };