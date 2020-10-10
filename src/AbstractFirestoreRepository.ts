import { plainToClass } from 'class-transformer';
import {
  DocumentSnapshot,
  QuerySnapshot,
  CollectionReference,
  Transaction,
} from '@google-cloud/firestore';
import { ValidationError } from './Errors/ValidationError';

import {
  IEntity,
  IQueryBuilder,
  IWherePropParam,
  IFirestoreVal,
  IFireOrmQueryLine,
  IOrderByParams,
  IRepository,
  PartialBy,
  IEntityConstructor,
} from './types';

import { getMetadataStorage } from './MetadataUtils';
import { MetadataStorageConfig, FullCollectionMetadata } from './MetadataStorage';

import { BaseRepository } from './BaseRepository';
import QueryBuilder from './QueryBuilder';
import { serializeEntity } from './utils';

export abstract class AbstractFirestoreRepository<T extends IEntity> extends BaseRepository
  implements IRepository<T> {
  protected readonly colMetadata: FullCollectionMetadata;
  protected readonly path: string;
  protected readonly config: MetadataStorageConfig;
  protected readonly firestoreColRef: CollectionReference;

  constructor(pathOrConstructor: string | IEntityConstructor) {
    super();

    const { getCollection, config, firestoreRef } = getMetadataStorage();

    if (!firestoreRef) {
      throw new Error('Firestore must be initialized first');
    }

    this.config = config;
    this.colMetadata = getCollection(pathOrConstructor);

    if (!this.colMetadata) {
      throw new Error(
        `There is no metadata stored for "${
          typeof pathOrConstructor === 'string' ? pathOrConstructor : pathOrConstructor.name
        }"`
      );
    }

    this.path = typeof pathOrConstructor === 'string' ? pathOrConstructor : this.colMetadata.name;
    this.firestoreColRef = firestoreRef.collection(this.path);
  }

  protected toSerializableObject = (obj: T): Record<string, unknown> =>
    serializeEntity(obj, this.colMetadata.subCollections);

  protected transformFirestoreTypes = (obj: T): T => {
    Object.keys(obj).forEach(key => {
      if (!obj[key]) return;
      if (typeof obj[key] === 'object' && 'toDate' in obj[key]) {
        obj[key] = obj[key].toDate();
      } else if (obj[key].constructor.name === 'GeoPoint') {
        const { latitude, longitude } = obj[key];
        obj[key] = { latitude, longitude };
      } else if (obj[key].constructor.name === 'DocumentReference') {
        const { id, path } = obj[key];
        obj[key] = { id, path };
      } else if (typeof obj[key] === 'object') {
        this.transformFirestoreTypes(obj[key]);
      }
    });
    return obj;
  };

  protected initializeSubCollections = (entity: T, tran?: Transaction) => {
    // Requiring here to prevent circular dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getRepository } = require('./helpers');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { FirestoreTransaction } = require('./Transaction/FirestoreTransaction');

    this.colMetadata.subCollections.forEach(subCol => {
      const pathWithSubCol = `${this.path}/${entity.id}/${subCol.name}`;

      // If we are inside a transaction, our subcollections should also be TransactionRepositories
      if (tran) {
        const firestoreTransaction = new FirestoreTransaction(tran);
        Object.assign(entity, {
          [subCol.propertyKey]: firestoreTransaction.getRepository(pathWithSubCol),
        });
      } else {
        Object.assign(entity, {
          [subCol.propertyKey]: getRepository(pathWithSubCol),
        });
      }
    });
  };

  protected extractTFromDocSnap = (doc: DocumentSnapshot, tran?: Transaction): T => {
    if (!doc.exists) {
      return null;
    }

    const entity = plainToClass(this.colMetadata.entityConstructor, {
      id: doc.id,
      ...this.transformFirestoreTypes(doc.data() as T),
    }) as T;

    this.initializeSubCollections(entity, tran);

    return entity;
  };

  protected extractTFromColSnap = (q: QuerySnapshot, tran?: Transaction): T[] => {
    return q.docs.map(d => this.extractTFromDocSnap(d, tran));
  };

  /**
   * Returns a new QueryBuilder with a filter specifying that the
   * value in @param prop must be equal to @param val.
   *
   * @param {IWherePropParam<T>} prop field to be filtered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @param {IFirestoreVal} val value to compare in the filter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * query applied.
   * @memberof AbstractFirestoreRepository
   */
  whereEqualTo(prop: IWherePropParam<T>, val: IFirestoreVal): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).whereEqualTo(prop, val);
  }

  /**
   * Returns a new QueryBuilder with a filter specifying that the
   * value in @param prop must be greater than @param val.
   *
   * @param {IWherePropParam<T>} prop field to be filtered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @param {IFirestoreVal} val value to compare in the filter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * query applied.
   * @memberof AbstractFirestoreRepository
   */
  whereGreaterThan(prop: IWherePropParam<T>, val: IFirestoreVal): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).whereGreaterThan(prop, val);
  }

  /**
   * Returns a new QueryBuilder with a filter specifying that the
   * value in @param prop must be greater or equal than @param val.
   *
   * @param {IWherePropParam<T>} prop field to be filtered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @param {IFirestoreVal} val value to compare in the filter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * query applied.
   * @memberof AbstractFirestoreRepository
   */
  whereGreaterOrEqualThan(prop: IWherePropParam<T>, val: IFirestoreVal): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).whereGreaterOrEqualThan(prop, val);
  }

  /**
   * Returns a new QueryBuilder with a filter specifying that the
   * value in @param prop must be less than @param val.
   *
   * @param {IWherePropParam<T>} prop field to be filtered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @param {IFirestoreVal} val value to compare in the filter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * query applied.
   * @memberof AbstractFirestoreRepository
   */
  whereLessThan(prop: IWherePropParam<T>, val: IFirestoreVal): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).whereLessThan(prop, val);
  }

  /**
   * Returns a new QueryBuilder with a filter specifying that the
   * value in @param prop must be less or equal than @param val.
   *
   * @param {IWherePropParam<T>} prop field to be filtered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @param {IFirestoreVal} val value to compare in the filter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * query applied.
   * @memberof AbstractFirestoreRepository
   */
  whereLessOrEqualThan(prop: IWherePropParam<T>, val: IFirestoreVal): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).whereLessOrEqualThan(prop, val);
  }

  /**
   * Returns a new QueryBuilder with a filter specifying that the
   * value in @param val must be contained in @param prop.
   *
   * @param {IWherePropParam<T>} prop field to be filtered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @param {IFirestoreVal} val value to compare in the filter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * query applied.
   * @memberof AbstractFirestoreRepository
   */
  whereArrayContains(prop: IWherePropParam<T>, val: IFirestoreVal): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).whereArrayContains(prop, val);
  }

  /**
   * Returns a new QueryBuilder with a maximum number of results
   * to return. Can only be used once per query.
   *
   * @param {number} limitVal maximum number of results to return
   * Must be greater or equal than 0
   * @returns {IQueryBuilder<T>} QueryBuilder A new QueryBuilder with
   * the specified limit applied
   * @memberof AbstractFirestoreRepository
   */
  limit(limitVal: number): IQueryBuilder<T> {
    if (limitVal < 0) {
      throw new Error(`limitVal must be greater than 0. It received: ${limitVal}`);
    }

    return new QueryBuilder<T>(this).limit(limitVal);
  }

  /**
   * Returns a new QueryBuilder with an additional ascending order
   * specified by @param prop. Can only be used once per query.
   *
   * @param {IWherePropParam<T>} prop field to be ordered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * ordering applied.
   * @memberof AbstractFirestoreRepository
   */
  orderByAscending(prop: IWherePropParam<T>): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).orderByAscending(prop);
  }

  /**
   * Returns a new QueryBuilder with an additional descending order
   * specified by @param prop. Can only be used once per query.
   *
   * @param {IWherePropParam<T>} prop field to be ordered on, where
   * prop could be keyof T or a lambda where T is the first parameter
   * @returns {QueryBuilder<T>} A new QueryBuilder with the specified
   * ordering applied.
   * @memberof AbstractFirestoreRepository
   */
  orderByDescending(prop: IWherePropParam<T>): IQueryBuilder<T> {
    return new QueryBuilder<T>(this).orderByDescending(prop);
  }

  /**
   * Execute the query and applies all the filters (if specified)
   *
   * @returns {Promise<T[]>} List of documents that matched the filters
   * (if specified)
   * @memberof AbstractFirestoreRepository
   */
  find(): Promise<T[]> {
    return new QueryBuilder<T>(this).find();
  }

  /**
   * Execute the query to find at least one document matching all
   * filters (if specified)
   *
   * @returns {Promise<T | null>} One document that matched the filters
   * (if specified), or null if none exists.
   *
   * @memberof AbstractFirestoreRepository
   */
  findOne(): Promise<T | null> {
    return new QueryBuilder<T>(this).findOne();
  }

  /**
   * Uses class-validator to validate an entity using decorators set in the collection class
   *
   * @param item class or object representing an entity
   * @returns {Promise<ValidationError[]>} An array of class-validator errors
   */
  async validate(item: T): Promise<ValidationError[]> {
    try {
      const classValidator = await import('class-validator');
      const { entityConstructor: Entity } = this.colMetadata;

      /**
       * Instantiate plain objects into an entity class
       */
      const entity = item instanceof Entity ? item : Object.assign(new Entity(), item);

      return classValidator.validate(entity);
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        throw new Error(
          'It looks like class-validator is not installed. Please run `npm i -S class-validator` to fix this error, or initialize FireORM with `validateModels: false` to disable validation.'
        );
      }

      throw error;
    }
  }

  /**
   * Takes all the queries stored by QueryBuilder and executes them.
   * Must be implemented by base repositores
   *
   * @abstract
   * @param {IFireOrmQueryLine[]} queries list of queries stored in
   * QueryBuilder
   * @param {number} [limitVal] (Optional) if a limit constraint
   * should be applied
   * @param {IOrderByParams} [orderByObj] (Optional) if a sortBy
   * clause should be applied
   * @returns {Promise<T[]>} results from firestore converted into
   * entities <T>
   * @memberof AbstractFirestoreRepository
   */
  abstract execute(
    queries: IFireOrmQueryLine[],
    limitVal?: number,
    orderByObj?: IOrderByParams,
    single?: boolean
  ): Promise<T[]>;

  /**
   * Retreive a document with the specified id.
   * Must be implemented by base repositores
   *
   * @abstract
   * @param {string} id
   * @returns {Promise<T>}
   * @memberof AbstractFirestoreRepository
   */
  abstract findById(id: string): Promise<T>;

  /**
   * Creates a document.
   * If no id is passed, is automatically generated.
   * Must be implemented by base repositores
   *
   * @abstract
   * @param {string} id
   * @returns {Promise<T>}
   * @memberof AbstractFirestoreRepository
   */
  abstract create(item: PartialBy<T, 'id'>): Promise<T>;

  /**
   * Updates a document.
   * Must be implemented by base repositores
   *
   * @abstract
   * @param {string} id
   * @returns {Promise<T>}
   * @memberof AbstractFirestoreRepository
   */
  abstract update(item: T): Promise<T>;

  /**
   * Deletes a document.
   * Must be implemented by base repositores
   *
   * @abstract
   * @param {string} id
   * @returns {Promise<T>}
   * @memberof AbstractFirestoreRepository
   */
  abstract delete(id: string): Promise<void>;
}
