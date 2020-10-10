import { SubCollection } from './SubCollection';
import { ISubCollection } from '../types';
import { Collection } from './Collection';

const setCollection = jest.fn();
jest.mock('../MetadataUtils', () => ({
  getMetadataStorage: jest.fn().mockImplementation(() => ({
    setCollection,
  })),
}));

describe('SubCollectionDecorator', () => {
  it('should register collections', () => {
    class SubEntity {
      public id: string;
    }
    @Collection()
    class Entity {
      id: string;

      @SubCollection(SubEntity, 'subs')
      subentity: ISubCollection<SubEntity>;
    }

    expect(setCollection).toHaveBeenCalledWith({
      name: 'subs',
      entityConstructor: SubEntity,
      parentEntityConstructor: Entity,
      propertyKey: 'subentity',
    });
  });

  it('should register collections with default name', () => {
    class SubEntity {
      public id: string;
    }

    @Collection()
    class Entity {
      id: string;

      @SubCollection(SubEntity)
      subentity: ISubCollection<SubEntity>;
    }

    expect(setCollection).toHaveBeenCalledWith({
      name: 'SubEntities',
      entityConstructor: SubEntity,
      parentEntityConstructor: Entity,
      propertyKey: 'subentity',
    });
  });
});
